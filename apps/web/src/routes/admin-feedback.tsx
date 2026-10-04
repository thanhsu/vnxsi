import type { Context, Hono } from "hono";
import { requireAdmin } from "../auth/middleware.ts";
import { auditStatement } from "../db/audit.ts";
import { countFeedback, findFeedbackById, listFeedback, setFeedbackStatusStatement } from "../db/feedback.ts";
import { FEEDBACK_PAGE_SIZE, FEEDBACK_STATUSES, feedbackTransition, type FeedbackAction, type FeedbackStatus } from "../domain/feedback.ts";
import type { AppEnv } from "../env.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import { localizedPath } from "../i18n/locales.ts";
import { FeedbackDetailPage } from "../views/admin/FeedbackDetailPage.tsx";
import { FeedbackPage } from "../views/admin/FeedbackPage.tsx";
import { errorResponse } from "../views/error-response.tsx";
import { page } from "../views/render.ts";

const ID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

function pageNumber(raw: string | undefined): number {
  const n = Number(raw ?? "1");
  return Number.isInteger(n) && n >= 1 && n <= 10_000 ? n : 1;
}

/** Plan VNX-0710: every status change goes through the domain rule, a compare-and-set and an audit row, in one batch. */
async function changeStatus(c: Context<AppEnv>, action: FeedbackAction) {
  const id = c.req.param("id") ?? "";
  const item = ID_RE.test(id) ? await findFeedbackById(c.env.DB, id) : null;
  if (!item) return errorResponse(c, "notFound", 404);
  const next = feedbackTransition(item.status, action);
  if (!next.ok) return errorResponse(c, "conflict", 409);
  const admin = c.get("user")!;
  const now = new Date().toISOString();
  const guard = { feedbackId: item.id, status: next.status, updatedAt: now };
  const [moved] = await c.env.DB.batch([
    setFeedbackStatusStatement(c.env.DB, { id: item.id, from: item.status, to: next.status, by: admin.id, now }),
    auditStatement(c.env.DB, { actorUserId: admin.id, action: `feedback.${action}`, entity: "feedback", entityId: item.id, data: { from: item.status, to: next.status }, now }, guard),
  ]);
  if (!moved || moved.results.length === 0) return errorResponse(c, "conflict", 409);
  return c.redirect(localizedPath(c.get("locale"), `/admin/feedback/${item.id}`), 303);
}

export function registerAdminFeedbackRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/admin/feedback", requireAdmin, async (c) => {
    const raw = c.req.query("status");
    const status = (FEEDBACK_STATUSES as readonly string[]).includes(raw ?? "") ? (raw as FeedbackStatus) : "new";
    const current = pageNumber(c.req.query("page"));
    // One row more than a page tells whether a next page exists.
    const rows = await listFeedback(c.env.DB, status, { limit: FEEDBACK_PAGE_SIZE + 1, offset: (current - 1) * FEEDBACK_PAGE_SIZE });
    const newCount = await countFeedback(c.env.DB, "new");
    return page(
      c,
      <FeedbackPage
        locale={c.get("locale")}
        origin={requestOrigin(c)}
        status={status}
        page={current}
        hasNext={rows.length > FEEDBACK_PAGE_SIZE}
        items={rows.slice(0, FEEDBACK_PAGE_SIZE)}
        newCount={newCount}
      />,
    );
  });

  onLocalized(app, "get", "/admin/feedback/:id", requireAdmin, async (c) => {
    const id = c.req.param("id") ?? "";
    const item = ID_RE.test(id) ? await findFeedbackById(c.env.DB, id) : null;
    if (!item) return errorResponse(c, "notFound", 404);
    const newCount = await countFeedback(c.env.DB, "new");
    return page(c, <FeedbackDetailPage locale={c.get("locale")} origin={requestOrigin(c)} item={item} newCount={newCount} />);
  });

  onLocalized(app, "post", "/admin/feedback/:id/handle", requireAdmin, (c) => changeStatus(c, "handle"));
  onLocalized(app, "post", "/admin/feedback/:id/spam", requireAdmin, (c) => changeStatus(c, "spam"));
  onLocalized(app, "post", "/admin/feedback/:id/reopen", requireAdmin, (c) => changeStatus(c, "reopen"));
}
