import type { Context, Hono } from "hono";
import { adminEmails } from "../auth/admin.ts";
import { opsNotFound, requireOps } from "../auth/ops.ts";
import { listEntityAudit } from "../db/audit.ts";
import { countBuildersByStatus, findBuilderAccount, searchBuilders } from "../db/builders.ts";
import { listMedia } from "../db/media.ts";
import { listTiers } from "../db/pricing.ts";
import { countProductsByStatus, findProductWithBuilder, searchProducts } from "../db/products.ts";
import { countRequestsByStatus, findAdminRequest, searchRequestsForAdmin } from "../db/requests.ts";
import { listActiveBadges } from "../db/verifications.ts";
import { isBuilderStatus, type BuilderAccount, type BuilderAction } from "../domain/builder.ts";
import { isProductStatus, RECENTLY_EDITED_DAYS, type BadgeKind, type ProductWithBuilder } from "../domain/product.ts";
import { REQUEST_STATUSES, type AdminRequest, type RequestStatus } from "../domain/request.ts";
import { can } from "../domain/ops.ts";
import type { AppEnv } from "../env.ts";
import type { IsRegistered } from "../ops/menu.ts";
import { BUILDERS_PATH, BuilderDetailPage, BuildersListPage, type BuilderFilter } from "../views/ops/BuildersPages.tsx";
import { qs, type HistoryView, type OpsNotice } from "../views/ops/parts.tsx";
import { PRODUCTS_PATH, ProductDetailPage, ProductsListPage, type ProductFilter } from "../views/ops/ProductsPages.tsx";
import { RequestDetailPage, REQUESTS_PATH, RequestsListPage, type RequestFilter } from "../views/ops/RequestsPages.tsx";
import type { InviteError } from "../views/admin/RequestDetailPage.tsx";
import { page } from "../views/render.ts";
import { decideBuilder } from "./admin.tsx";
import { decideProduct, grantProductBadge, revokeProductBadge, type AdminProductAction, type BadgeDecision, type BadgeError } from "./admin-products.tsx";
import { inviteToRequest, rejectRequest, removeRequest, requestMatching, type RequestDecision } from "./admin-requests.tsx";
import { actorOf, opsShell, registeredPaths } from "./ops.tsx";

/**
 * Ops Marketplace queues (VNX-2504a Builders, VNX-2504a2 Products, VNX-2504b Requests; spec §2.2, §3.1, §7.3). Pages
 * need marketplace.view, every POST marketplace.act; anyone else gets the sealed 404 of requireOps. The decisions are
 * the /admin ones (decideBuilder, decideProduct, the badge and the request functions): same state machine,
 * compare-and-set, badges, invitations, audit and e-mail. Filters come from the URL and only allowlisted values are kept.
 */

const SEARCH_MAX = 100;
const HISTORY_LIMIT = 50;

/** A search of 1–100 characters after trimming; anything else is ignored. */
function searchOf(value: string | undefined): string | null {
  const q = (value ?? "").trim();
  return q && q.length <= SEARCH_MAX ? q : null;
}

function noticeOf(value: string | undefined): OpsNotice {
  return value === "1" ? "done" : value === "mail_failed" ? "mail_failed" : null;
}

/** The builder filter as given in the URL: a known status and a usable search, nothing else. */
function builderFilter(c: Context<AppEnv>): BuilderFilter {
  const status = c.req.query("status");
  const q = searchOf(c.req.query("q"));
  return { ...(isBuilderStatus(status) ? { status } : {}), ...(q ? { q } : {}) };
}

/** The product filter as given in the URL: a known status or the edited view, and a usable search, nothing else. */
function productFilter(c: Context<AppEnv>): ProductFilter {
  const status = c.req.query("status");
  const q = searchOf(c.req.query("q"));
  const tab: ProductFilter = c.req.query("view") === "edited" ? { view: "edited" } : isProductStatus(status) ? { status } : {};
  return { ...tab, ...(q ? { q } : {}) };
}

const isRequestStatus = (value: string | undefined): value is RequestStatus => (REQUEST_STATUSES as readonly string[]).includes(value ?? "");

/** The request filter as given in the URL: a known status or "all", and a usable search, nothing else. */
function requestFilter(c: Context<AppEnv>): RequestFilter {
  const status = c.req.query("status");
  const q = searchOf(c.req.query("q"));
  return { ...(status === "all" || isRequestStatus(status) ? { status } : {}), ...(q ? { q } : {}) };
}

/** The object's History: audit rows in the safe projection; a failed read is an error state, never an empty list. */
async function historyOf(c: Context<AppEnv>, entity: string, entityId: string): Promise<HistoryView> {
  try {
    const owners = adminEmails(c.env);
    const rows = await listEntityAudit(c.env.DB, entity, entityId, HISTORY_LIMIT);
    return { state: "ok", rows: rows.map((r) => ({ id: r.id, at: r.createdAt, actor: actorOf(r, owners), action: r.action, entity: r.entity, entityId: r.entityId })) };
  } catch (err) {
    console.error(JSON.stringify({ requestId: c.get("requestId"), event: "ops.history_failed", entity, error: String(err) }));
    return { state: "error" };
  }
}

export function registerOpsMarketplaceRoutes(app: Hono<AppEnv>) {
  const isRegistered: IsRegistered = registeredPaths(app);

  async function builderDetail(c: Context<AppEnv>, builder: BuilderAccount, notice: OpsNotice, status: 200 | 400 | 409 = 200, reasonError?: BuilderAction) {
    const [shell, history] = await Promise.all([opsShell(c, isRegistered, BUILDERS_PATH), historyOf(c, "builder", builder.userId)]);
    const canAct = can(c.get("opsRole"), "marketplace.act");
    return page(c, <BuilderDetailPage shell={shell} builder={builder} filter={builderFilter(c)} canAct={canAct} notice={notice} reasonError={reasonError} history={history} />, status);
  }

  async function productDetail(
    c: Context<AppEnv>,
    item: ProductWithBuilder,
    notice: OpsNotice,
    status: 200 | 400 | 409 = 200,
    errors: { noteError?: AdminProductAction; badgeError?: BadgeError } = {},
  ) {
    const id = item.product.id;
    const [shell, history, tiers, media, badges] = await Promise.all([
      opsShell(c, isRegistered, PRODUCTS_PATH),
      historyOf(c, "product", id),
      listTiers(c.env.DB, id),
      listMedia(c.env.DB, id),
      listActiveBadges(c.env.DB, id),
    ]);
    const canAct = can(c.get("opsRole"), "marketplace.act");
    const errorKind = errors.badgeError === "reason" ? (c.req.param("kind") as BadgeKind) : undefined;
    return page(
      c,
      <ProductDetailPage
        shell={shell}
        item={item}
        tiers={tiers}
        media={media}
        badges={badges}
        filter={productFilter(c)}
        canAct={canAct}
        notice={notice}
        noteError={errors.noteError}
        badgeError={errors.badgeError ?? null}
        errorKind={errorKind}
        history={history}
      />,
      status,
    );
  }

  /** A lost race or a move the state machine refuses wrote nothing: show the current state, as a 409. */
  async function productConflict(c: Context<AppEnv>) {
    const current = await findProductWithBuilder(c.env.DB, c.req.param("id") ?? "");
    return current ? productDetail(c, current, "conflict", 409) : opsNotFound(c);
  }

  const productDone = (c: Context<AppEnv>, productId: string, mailed: boolean) =>
    c.redirect(`${PRODUCTS_PATH}/${productId}${qs({ ...productFilter(c), done: mailed ? "1" : "mail_failed" })}`, 303);

  async function badgeAnswer(c: Context<AppEnv>, r: BadgeDecision) {
    if (r.kind === "not_found") return opsNotFound(c);
    if (r.kind === "invalid") return productDetail(c, r.item, null, 400, { badgeError: r.error });
    if (r.kind === "conflict") return productConflict(c);
    return productDone(c, r.productId, true);
  }

  type RequestErrors = { inviteError?: InviteError; noteError?: boolean; values?: { note?: string; handle?: string } };

  async function requestDetail(c: Context<AppEnv>, item: AdminRequest, notice: OpsNotice, status: 200 | 400 | 409 = 200, errors: RequestErrors = {}) {
    const [shell, history, matching] = await Promise.all([opsShell(c, isRegistered, REQUESTS_PATH), historyOf(c, "request", item.request.id), requestMatching(c.env.DB, item)]);
    const canAct = can(c.get("opsRole"), "marketplace.act");
    return page(c, <RequestDetailPage shell={shell} item={item} {...matching} filter={requestFilter(c)} canAct={canAct} notice={notice} history={history} {...errors} />, status);
  }

  /** Ops's answer to each outcome of the shared request functions; `doneTo` is where a success goes. */
  async function requestAnswer(c: Context<AppEnv>, r: RequestDecision, doneTo: (r: { requestId: string; mailed: boolean }) => string) {
    if (r.kind === "not_found") return opsNotFound(c);
    if (r.kind === "invalid_invite") return requestDetail(c, r.item, null, 400, { inviteError: r.error, values: { handle: r.handle } });
    if (r.kind === "invalid_note") return requestDetail(c, r.item, null, 400, { noteError: true, values: { note: r.note } });
    if (r.kind === "conflict") {
      // Nothing was written. Show the current state with the reason, as a 409.
      const current = await findAdminRequest(c.env.DB, c.req.param("id") ?? "");
      return current ? requestDetail(c, current, "conflict", 409) : opsNotFound(c);
    }
    return c.redirect(doneTo(r), 303);
  }

  const requestDone = (c: Context<AppEnv>) => (r: { requestId: string; mailed: boolean }) => `${REQUESTS_PATH}/${r.requestId}${qs({ ...requestFilter(c), done: r.mailed ? "1" : "mail_failed" })}`;

  app.get(BUILDERS_PATH, requireOps("marketplace.view"), async (c) => {
    const given = c.req.query("status");
    const status = isBuilderStatus(given) ? given : "pending";
    const q = searchOf(c.req.query("q"));
    const [shell, counts, builders] = await Promise.all([opsShell(c, isRegistered, BUILDERS_PATH), countBuildersByStatus(c.env.DB), searchBuilders(c.env.DB, status, q)]);
    return page(c, <BuildersListPage shell={shell} status={status} q={q} counts={counts} builders={builders} />);
  });

  app.get(`${BUILDERS_PATH}/:userId`, requireOps("marketplace.view"), async (c) => {
    const builder = await findBuilderAccount(c.env.DB, c.req.param("userId"));
    if (!builder) return opsNotFound(c);
    return builderDetail(c, builder, noticeOf(c.req.query("done")));
  });

  for (const action of ["approve", "reject", "suspend", "unsuspend"] as const) {
    app.post(`${BUILDERS_PATH}/:userId/${action}`, requireOps("marketplace.act"), async (c) => {
      const r = await decideBuilder(c, action);
      if (r.kind === "not_found") return opsNotFound(c);
      if (r.kind === "invalid_reason") return builderDetail(c, r.builder, null, 400, action);
      if (r.kind === "conflict") {
        // Nothing was written. Show the current state with the reason, as a 409.
        const current = await findBuilderAccount(c.env.DB, c.req.param("userId"));
        return current ? builderDetail(c, current, "conflict", 409) : opsNotFound(c);
      }
      return c.redirect(`${BUILDERS_PATH}/${r.userId}${qs({ ...builderFilter(c), done: r.mailed ? "1" : "mail_failed" })}`, 303);
    });
  }

  app.get(PRODUCTS_PATH, requireOps("marketplace.view"), async (c) => {
    const given = c.req.query("status");
    const status = c.req.query("view") === "edited" ? null : isProductStatus(given) ? given : "in_review";
    const q = searchOf(c.req.query("q"));
    const editedSince = new Date(Date.now() - RECENTLY_EDITED_DAYS * 86_400_000).toISOString();
    const [shell, counts, items] = await Promise.all([
      opsShell(c, isRegistered, PRODUCTS_PATH),
      countProductsByStatus(c.env.DB, editedSince),
      searchProducts(c.env.DB, status ? { status } : { editedSince }, q),
    ]);
    return page(c, <ProductsListPage shell={shell} status={status} q={q} counts={counts} items={items} />);
  });

  app.get(`${PRODUCTS_PATH}/:id`, requireOps("marketplace.view"), async (c) => {
    const item = await findProductWithBuilder(c.env.DB, c.req.param("id"));
    if (!item) return opsNotFound(c);
    return productDetail(c, item, noticeOf(c.req.query("done")));
  });

  for (const action of ["approve", "request_changes", "suspend", "unsuspend"] as const) {
    app.post(`${PRODUCTS_PATH}/:id/${action}`, requireOps("marketplace.act"), async (c) => {
      const r = await decideProduct(c, action);
      if (r.kind === "not_found") return opsNotFound(c);
      if (r.kind === "invalid_note") return productDetail(c, r.item, null, 400, { noteError: action });
      if (r.kind === "conflict") return productConflict(c);
      return productDone(c, r.productId, r.mailed);
    });
  }

  app.post(`${PRODUCTS_PATH}/:id/badges`, requireOps("marketplace.act"), async (c) => badgeAnswer(c, await grantProductBadge(c)));
  app.post(`${PRODUCTS_PATH}/:id/badges/:kind/revoke`, requireOps("marketplace.act"), async (c) => badgeAnswer(c, await revokeProductBadge(c)));

  app.get(REQUESTS_PATH, requireOps("marketplace.view"), async (c) => {
    const given = c.req.query("status");
    const status = given === "all" ? null : isRequestStatus(given) ? given : "submitted";
    const q = searchOf(c.req.query("q"));
    const [shell, counts, items] = await Promise.all([opsShell(c, isRegistered, REQUESTS_PATH), countRequestsByStatus(c.env.DB), searchRequestsForAdmin(c.env.DB, status, q)]);
    return page(c, <RequestsListPage shell={shell} status={status} q={q} counts={counts} items={items} notice={noticeOf(c.req.query("done"))} />);
  });

  app.get(`${REQUESTS_PATH}/:id`, requireOps("marketplace.view"), async (c) => {
    const item = await findAdminRequest(c.env.DB, c.req.param("id"));
    if (!item) return opsNotFound(c);
    return requestDetail(c, item, noticeOf(c.req.query("done")));
  });

  app.post(`${REQUESTS_PATH}/:id/invite`, requireOps("marketplace.act"), async (c) => requestAnswer(c, await inviteToRequest(c), requestDone(c)));
  app.post(`${REQUESTS_PATH}/:id/reject`, requireOps("marketplace.act"), async (c) => requestAnswer(c, await rejectRequest(c), requestDone(c)));
  // After a removal the request leaves most tabs: back to the list, with the filter and the outcome.
  app.post(`${REQUESTS_PATH}/:id/remove`, requireOps("marketplace.act"), async (c) =>
    requestAnswer(c, await removeRequest(c), (r) => REQUESTS_PATH + qs({ ...requestFilter(c), done: r.mailed ? "1" : "mail_failed" })),
  );
}
