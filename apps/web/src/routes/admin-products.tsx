import type { Context, Hono } from "hono";
import { z } from "zod";
import { requireAdmin } from "../auth/middleware.ts";
import { auditStatement, writeAudit } from "../db/audit.ts";
import { listMedia } from "../db/media.ts";
import { listTiers } from "../db/pricing.ts";
import { findProductWithBuilder, listProductsByStatus, listRecentlyEdited, returnedProduct, setProductStatusStatement, type ProductGuard } from "../db/products.ts";
import { grantBadge, grantBadgeStatement, listActiveBadges, revokeBadge } from "../db/verifications.ts";
import { normalizeNewlines } from "../domain/product-input.ts";
import { isProductStatus, RECENTLY_EDITED_DAYS, transition, type BadgeKind, type ProductAction, type ProductWithBuilder } from "../domain/product.ts";
import { getMailer } from "../email/index.ts";
import { productApprovedEmail, productChangesEmail } from "../email/templates/product-decision.ts";
import type { AppEnv } from "../env.ts";
import { isLocale, localizedPath } from "../i18n/locales.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import type { AdminNotice } from "../views/admin/BuilderDetailPage.tsx";
import { ProductDetailPage } from "../views/admin/ProductDetailPage.tsx";
import { ProductsQueuePage } from "../views/admin/ProductsQueuePage.tsx";
import { errorResponse } from "../views/error-response.tsx";
import { page } from "../views/render.ts";

export type BadgeError = "kind" | "evidence" | "reason";

type AdminProductAction = Extract<ProductAction, "approve" | "request_changes" | "suspend" | "unsuspend">;

/** request_changes must say why (spec §5.5: review_note bắt buộc). Stored in products.review_note. */
const NOTE: Record<AdminProductAction, "required" | "optional" | "none"> = { approve: "none", request_changes: "required", suspend: "optional", unsuspend: "none" };
const NoteSchema = { required: z.string().trim().min(1).max(1000), optional: z.string().trim().max(1000) };

function noticeFrom(value: string | undefined): AdminNotice {
  return value === "1" ? "done" : value === "mail_failed" ? "mail_failed" : null;
}

/** Exported for Task 7 (badge forms re-render the same page). */
export async function productDetail(c: Context<AppEnv>, item: ProductWithBuilder, notice: AdminNotice, status: 200 | 400 | 409 = 200, noteError?: AdminProductAction, badgeError: BadgeError | null = null) {
  const [tiers, media, badges] = await Promise.all([listTiers(c.env.DB, item.product.id), listMedia(c.env.DB, item.product.id), listActiveBadges(c.env.DB, item.product.id)]);
  return page(
    c,
    <ProductDetailPage locale={c.get("locale")} origin={requestOrigin(c)} item={item} tiers={tiers} media={media} badges={badges} notice={notice} noteError={noteError} badgeError={badgeError} />,
    status,
  );
}

async function notify(c: Context<AppEnv>, item: ProductWithBuilder, action: "approve" | "request_changes", note: string | null): Promise<boolean> {
  const locale = isLocale(item.builderLocale) ? item.builderLocale : "en";
  const url = (path: string) => new URL(localizedPath(locale, path), c.env.APP_ORIGIN).toString();
  const p = item.product;
  const message =
    action === "approve"
      ? productApprovedEmail(locale, { name: p.name, productUrl: url(`/p/${p.slug}`), hubUrl: url("/hub/products") })
      : productChangesEmail(locale, { name: p.name, note: note ?? "", editUrl: url(`/hub/products/${p.id}/edit/product`) });
  try {
    await getMailer(c.env).send({ to: item.builderEmail, ...message });
    return true;
  } catch (err) {
    console.error(JSON.stringify({ requestId: c.get("requestId"), event: "product.mail_failed", action, error: String(err) }));
    return false;
  }
}

async function decideProduct(c: Context<AppEnv>, action: AdminProductAction) {
  const admin = c.get("user")!;
  const item = await findProductWithBuilder(c.env.DB, c.req.param("id") ?? "");
  if (!item) return errorResponse(c, "notFound", 404);

  let note: string | null = null;
  const policy = NOTE[action];
  if (policy !== "none") {
    const body = await c.req.parseBody();
    const parsed = NoteSchema[policy].safeParse(normalizeNewlines(typeof body.note === "string" ? body.note : ""));
    if (!parsed.success) return productDetail(c, item, null, 400, action);
    note = parsed.data || null;
  }

  const p = item.product;
  const next = transition(p.status, action, "admin");
  if (!next.ok) return errorResponse(c, "conflict", 409);
  const now = new Date().toISOString();
  // One transaction: status, the system "listed" badge and the audit row commit together. Everything after the
  // compare-and-set is guarded on it, so a lost race (0 rows changed) writes nothing.
  const guard: ProductGuard = { productId: p.id, status: next.status, updatedAt: now };
  const statements = [setProductStatusStatement(c.env.DB, { id: p.id, from: p.status, to: next.status, reviewNote: note, now })];
  // Spec §7.2: approval adds "listed" (no-op when one is already active); unsuspending repairs a missing one.
  if (action === "approve" || action === "unsuspend") {
    statements.push(grantBadgeStatement(c.env.DB, { productId: p.id, kind: "listed", verifiedBy: null, evidence: "", now }, guard));
  }
  statements.push(auditStatement(c.env.DB, { actorUserId: admin.id, action: `product.${action}`, entity: "product", entityId: p.id, data: { from: p.status, to: next.status, note }, now }, guard));
  const updated = returnedProduct((await c.env.DB.batch(statements))[0]);
  if (!updated) return errorResponse(c, "conflict", 409);
  const mailed = action === "approve" || action === "request_changes" ? await notify(c, { ...item, product: updated }, action, note) : true;
  return c.redirect(localizedPath(c.get("locale"), `/admin/products/${p.id}?done=${mailed ? "1" : "mail_failed"}`), 303);
}

const GRANTABLE = new Set<BadgeKind>(["demo_verified", "in_production"]);
const Evidence = z.string().trim().min(1).max(500);
const Reason = z.string().trim().min(1).max(300);

export function registerAdminProductRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/admin/products", requireAdmin, async (c) => {
    if (c.req.query("view") === "edited") {
      const since = new Date(Date.now() - RECENTLY_EDITED_DAYS * 86_400_000).toISOString();
      const items = await listRecentlyEdited(c.env.DB, since);
      return page(c, <ProductsQueuePage locale={c.get("locale")} origin={requestOrigin(c)} view="edited" status="in_review" items={items} />);
    }
    const q = c.req.query("status");
    const status = isProductStatus(q) ? q : "in_review";
    const items = await listProductsByStatus(c.env.DB, status);
    return page(c, <ProductsQueuePage locale={c.get("locale")} origin={requestOrigin(c)} view="status" status={status} items={items} />);
  });

  onLocalized(app, "get", "/admin/products/:id", requireAdmin, async (c) => {
    const item = await findProductWithBuilder(c.env.DB, c.req.param("id") ?? "");
    if (!item) return errorResponse(c, "notFound", 404);
    return productDetail(c, item, noticeFrom(c.req.query("done")));
  });

  for (const action of ["approve", "request_changes", "suspend", "unsuspend"] as const) {
    onLocalized(app, "post", `/admin/products/:id/${action}`, requireAdmin, (c) => decideProduct(c, action));
  }

  onLocalized(app, "post", "/admin/products/:id/badges", requireAdmin, async (c) => {
    const item = await findProductWithBuilder(c.env.DB, c.req.param("id") ?? "");
    if (!item || item.product.status === "archived") return errorResponse(c, "notFound", 404);
    const body = await c.req.parseBody();
    const kind = body.kind as BadgeKind;
    if (!GRANTABLE.has(kind)) return productDetail(c, item, null, 400, undefined, "kind");
    const evidence = Evidence.safeParse(normalizeNewlines(typeof body.evidence === "string" ? body.evidence : ""));
    if (!evidence.success) return productDetail(c, item, null, 400, undefined, "evidence");
    const now = new Date().toISOString();
    const admin = c.get("user")!;
    if (!(await grantBadge(c.env.DB, { productId: item.product.id, kind, verifiedBy: admin.id, evidence: evidence.data, now }))) return errorResponse(c, "conflict", 409);
    await writeAudit(c.env.DB, { actorUserId: admin.id, action: "badge.grant", entity: "product", entityId: item.product.id, data: { kind, evidence: evidence.data }, now });
    return c.redirect(localizedPath(c.get("locale"), `/admin/products/${item.product.id}?done=1`), 303);
  });

  onLocalized(app, "post", "/admin/products/:id/badges/:kind/revoke", requireAdmin, async (c) => {
    const item = await findProductWithBuilder(c.env.DB, c.req.param("id") ?? "");
    const kind = c.req.param("kind") as BadgeKind;
    if (!item || !GRANTABLE.has(kind)) return errorResponse(c, "notFound", 404);
    const body = await c.req.parseBody();
    const reason = Reason.safeParse(normalizeNewlines(typeof body.reason === "string" ? body.reason : ""));
    if (!reason.success) return productDetail(c, item, null, 400, undefined, "reason");
    const now = new Date().toISOString();
    if (!(await revokeBadge(c.env.DB, { productId: item.product.id, kind, reason: reason.data, now }))) return errorResponse(c, "conflict", 409);
    await writeAudit(c.env.DB, { actorUserId: c.get("user")!.id, action: "badge.revoke", entity: "product", entityId: item.product.id, data: { kind, reason: reason.data }, now });
    return c.redirect(localizedPath(c.get("locale"), `/admin/products/${item.product.id}?done=1`), 303);
  });
}
