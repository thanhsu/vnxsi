import type { Context, Hono } from "hono";
import { z } from "zod";
import { requireAdmin } from "../auth/middleware.ts";
import { writeAudit } from "../db/audit.ts";
import { findBuilderAccount, listBuildersByStatus, setBuilderStatus } from "../db/builders.ts";
import { isBuilderStatus, transition, type BuilderAccount, type BuilderAction } from "../domain/builder.ts";
import { getMailer } from "../email/index.ts";
import { builderApprovedEmail, builderRejectedEmail } from "../email/templates/builder-decision.ts";
import type { AppEnv } from "../env.ts";
import { isLocale, localizedPath } from "../i18n/locales.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import { BuilderDetailPage, type AdminNotice } from "../views/admin/BuilderDetailPage.tsx";
import { BuildersPage } from "../views/admin/BuildersPage.tsx";
import { errorResponse } from "../views/error-response.tsx";
import { page } from "../views/render.ts";

/** Which admin actions take a reason (spec §5.5: rejecting needs one). Stored in builders.review_note. */
const REASON: Record<BuilderAction, "required" | "optional" | "none"> = {
  approve: "none",
  reject: "required",
  suspend: "optional",
  unsuspend: "none",
  resubmit: "none",
};
const ReasonSchema = { required: z.string().trim().min(1).max(500), optional: z.string().trim().max(500) };

function noticeFrom(value: string | undefined): AdminNotice {
  return value === "1" ? "done" : value === "mail_failed" ? "mail_failed" : null;
}

export function registerAdminRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/admin", requireAdmin, (c) => c.redirect(localizedPath(c.get("locale"), "/admin/builders"), 303));

  onLocalized(app, "get", "/admin/builders", requireAdmin, async (c) => {
    const q = c.req.query("status");
    const status = isBuilderStatus(q) ? q : "pending";
    const builders = await listBuildersByStatus(c.env.DB, status);
    return page(c, <BuildersPage locale={c.get("locale")} origin={requestOrigin(c)} status={status} builders={builders} />);
  });

  onLocalized(app, "get", "/admin/builders/:userId", requireAdmin, async (c) => {
    const builder = await findBuilderAccount(c.env.DB, c.req.param("userId") ?? "");
    if (!builder) return errorResponse(c, "notFound", 404);
    return page(c, <BuilderDetailPage locale={c.get("locale")} origin={requestOrigin(c)} builder={builder} notice={noticeFrom(c.req.query("done"))} />);
  });

  onLocalized(app, "post", "/admin/builders/:userId/approve", requireAdmin, (c) => decide(c, "approve"));
  onLocalized(app, "post", "/admin/builders/:userId/reject", requireAdmin, (c) => decide(c, "reject"));
}

/** Shared by every admin action on a builder: validate, compare-and-set, audit, notify. */
export async function decide(c: Context<AppEnv>, action: BuilderAction) {
  const admin = c.get("user")!;
  const builder = await findBuilderAccount(c.env.DB, c.req.param("userId") ?? "");
  if (!builder) return errorResponse(c, "notFound", 404);

  let reason: string | null = null;
  const policy = REASON[action];
  if (policy !== "none") {
    const body = await c.req.parseBody();
    const parsed = ReasonSchema[policy].safeParse(typeof body.reason === "string" ? body.reason : "");
    if (!parsed.success) {
      return page(c, <BuilderDetailPage locale={c.get("locale")} origin={requestOrigin(c)} builder={builder} notice={null} reasonError={action} />, 400);
    }
    reason = parsed.data || null;
  }

  const next = transition(builder.status, action, "admin");
  if (!next.ok) return errorResponse(c, "conflict", 409);
  const now = new Date().toISOString();
  const updated = await setBuilderStatus(c.env.DB, { userId: builder.userId, from: builder.status, to: next.status, reviewNote: reason, now });
  if (!updated) return errorResponse(c, "conflict", 409);
  await writeAudit(c.env.DB, {
    actorUserId: admin.id,
    action: `builder.${action}`,
    entity: "builder",
    entityId: builder.userId,
    data: { from: builder.status, to: next.status, reason },
    now,
  });

  const mailed = action === "approve" || action === "reject" ? await notify(c, builder, action, reason) : true;
  return c.redirect(localizedPath(c.get("locale"), `/admin/builders/${builder.userId}?done=${mailed ? "1" : "mail_failed"}`), 303);
}

/** Spec §8.3: tell the builder in their own language. A failed send never undoes the decision. */
async function notify(c: Context<AppEnv>, builder: BuilderAccount, action: "approve" | "reject", reason: string | null): Promise<boolean> {
  const locale = isLocale(builder.userLocale) ? builder.userLocale : "en";
  const url = (path: string) => new URL(localizedPath(locale, path), c.env.APP_ORIGIN).toString();
  const message =
    action === "approve"
      ? builderApprovedEmail(locale, { name: builder.name, profileUrl: url(`/b/${builder.handle}`), hubUrl: url("/hub") })
      : builderRejectedEmail(locale, { name: builder.name, reason: reason ?? "", profileUrl: url("/hub/profile") });
  try {
    await getMailer(c.env).send({ to: builder.email, ...message });
    return true;
  } catch (err) {
    console.error(JSON.stringify({ requestId: c.get("requestId"), event: "builder.mail_failed", action, error: String(err) }));
    return false;
  }
}
