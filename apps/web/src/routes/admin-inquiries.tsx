import type { Hono } from "hono";
import { requireAdmin } from "../auth/middleware.ts";
import { auditStatement } from "../db/audit.ts";
import { findInquiryById, listInquiriesForAdmin, returnedInquiry, setInquiryStatusStatement } from "../db/inquiries.ts";
import { INQUIRY_STATUSES, transition, type InquiryStatus } from "../domain/inquiry.ts";
import type { AppEnv } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import { AdminInquiriesPage } from "../views/admin/InquiriesPage.tsx";
import { errorResponse } from "../views/error-response.tsx";
import { page } from "../views/render.ts";

export function registerAdminInquiryRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/admin/inquiries", requireAdmin, async (c) => {
    const raw = c.req.query("status");
    const status = (INQUIRY_STATUSES as readonly string[]).includes(raw ?? "") ? (raw as InquiryStatus) : null;
    const items = await listInquiriesForAdmin(c.env.DB, status);
    return page(c, <AdminInquiriesPage locale={c.get("locale")} origin={requestOrigin(c)} status={status} items={items} />);
  });

  onLocalized(app, "post", "/admin/inquiries/:id/remove", requireAdmin, async (c) => {
    const inquiry = await findInquiryById(c.env.DB, c.req.param("id") ?? "");
    if (!inquiry) return errorResponse(c, "notFound", 404);
    const next = transition(inquiry.status, "remove", "admin");
    if (!next.ok) return errorResponse(c, "conflict", 409);
    const iso = new Date().toISOString();
    const guard = { inquiryId: inquiry.id, status: next.status, updatedAt: iso };
    const [moved] = await c.env.DB.batch([
      setInquiryStatusStatement(c.env.DB, { id: inquiry.id, from: inquiry.status, to: next.status, now: iso }),
      auditStatement(c.env.DB, { actorUserId: c.get("user")!.id, action: "inquiry.remove", entity: "inquiry", entityId: inquiry.id, data: { from: inquiry.status }, now: iso }, guard),
    ]);
    if (!returnedInquiry(moved)) return errorResponse(c, "conflict", 409);
    return c.redirect(localizedPath(c.get("locale"), "/admin/inquiries"), 303);
  });
}
