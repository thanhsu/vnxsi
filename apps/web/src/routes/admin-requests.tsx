import type { Context, Hono } from "hono";
import { requireAdmin } from "../auth/middleware.ts";
import { auditStatement } from "../db/audit.ts";
import { findPublicBuilderByHandle } from "../db/builders.ts";
import { endRequestBatch, findAdminRequest, inviteBuildersBatch, listCandidates, listRequestInvites, listRequestsForAdmin } from "../db/requests.ts";
import { HANDLE_RE } from "../domain/builder-input.ts";
import {
  EXPIRED_PENALTY_WINDOW_MS,
  MAX_ACTIVE_INVITES,
  parseAdminNote,
  REQUEST_STATUSES,
  requestTransition,
  suggestBuilders,
  type AdminRequest,
  type ClientRequest,
  type RequestStatus,
  type TerminalRequestStatus,
} from "../domain/request.ts";
import type { AppEnv } from "../env.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import { localizedPath } from "../i18n/locales.ts";
import { notifyInvited, notifyInviteExpired, notifyNotSelected, notifyRequestRejected } from "../notify/request.ts";
import { RequestDetailPage, type InviteError } from "../views/admin/RequestDetailPage.tsx";
import { AdminRequestsPage } from "../views/admin/RequestsPage.tsx";
import { errorResponse } from "../views/error-response.tsx";
import { page } from "../views/render.ts";

type DetailExtra = { inviteError?: InviteError; noteError?: boolean; values?: { note?: string; handle?: string } };

async function detailPage(c: Context<AppEnv>, item: AdminRequest, extra: DetailExtra = {}, status: 200 | 400 = 200) {
  const invites = await listRequestInvites(c.env.DB, item.request.id);
  const canInvite = requestTransition(item.request.status, "invite", "admin").ok && item.activeInvites < MAX_ACTIVE_INVITES;
  const since = new Date(Date.now() - EXPIRED_PENALTY_WINDOW_MS).toISOString();
  const suggestions = canInvite ? suggestBuilders(item.request, await listCandidates(c.env.DB, item.request, since)) : null;
  const done = c.req.query("done");
  const notice = done === "1" ? "done" : done === "mail_failed" ? "mail_failed" : null;
  return page(c, <RequestDetailPage locale={c.get("locale")} origin={requestOrigin(c)} item={item} invites={invites} suggestions={suggestions} notice={notice} {...extra} />, status);
}

const listOf = (value: unknown): string[] => (Array.isArray(value) ? value : value === undefined ? [] : [value]).filter((v): v is string => typeof v === "string" && v !== "");

/**
 * Spec §5.7 step 2: up to 5 active invitations. The checks here only give quick answers; the INSERT in
 * inviteBuildersBatch is the real guard (cap, duplicate, client, eligibility, request status), so a lost race or a forged
 * checkbox invites nobody and answers 409.
 */
async function invite(c: Context<AppEnv>) {
  const item = await findAdminRequest(c.env.DB, c.req.param("id") ?? "");
  if (!item) return errorResponse(c, "notFound", 404);
  if (!requestTransition(item.request.status, "invite", "admin").ok) return errorResponse(c, "conflict", 409);
  const body = await c.req.parseBody({ all: true });
  const picked = new Set(listOf(body.builder));
  const handle = (typeof body.handle === "string" ? body.handle : "").trim().toLowerCase();
  let error: InviteError | null = null;
  if (handle) {
    const builder = HANDLE_RE.test(handle) ? await findPublicBuilderByHandle(c.env.DB, handle) : null;
    if (builder) picked.add(builder.userId);
    else error = "handle";
  }
  if (!error && picked.size === 0) error = "none";
  if (!error && picked.size > MAX_ACTIVE_INVITES - item.activeInvites) error = "too_many";
  if (error) return detailPage(c, item, { inviteError: error, values: { handle } }, 400);

  const admin = c.get("user")!;
  const now = new Date().toISOString();
  const batch = inviteBuildersBatch(c.env.DB, { requestId: item.request.id, builderIds: [...picked], invitedBy: admin.id, now });
  const results = await c.env.DB.batch([
    ...batch.statements,
    auditStatement(
      c.env.DB,
      { actorUserId: admin.id, action: "request.invite", entity: "request", entityId: item.request.id, data: { from: item.request.status, requested: [...picked] }, now },
      { requestId: item.request.id, inviteIds: batch.inviteIds },
    ),
  ]);
  const outcome = batch.read(results);
  if (!outcome.request) return errorResponse(c, "conflict", 409); // nobody was invited: nothing was written
  const mailed = await notifyInvited(c.env, outcome.invited.map((i) => i.id));
  return c.redirect(localizedPath(c.get("locale"), `/admin/requests/${item.request.id}?done=${mailed.failed > 0 ? "mail_failed" : "1"}`), 303);
}

/**
 * Ends the request as the admin (returned or spam): settles the invitations, audits, and after the commit tells the
 * builders whose invitation ended (not_selected / expired; Owner: also after spam). `null` = lost the compare-and-set.
 */
async function end(c: Context<AppEnv>, item: AdminRequest, to: Extract<TerminalRequestStatus, "rejected" | "removed">, adminNote: string | null): Promise<{ request: ClientRequest; mailFailed: boolean } | null> {
  const now = new Date().toISOString();
  const r = item.request;
  const batch = endRequestBatch(c.env.DB, { id: r.id, from: r.status, to, now, adminNote });
  const results = await c.env.DB.batch([
    ...batch.statements,
    auditStatement(
      c.env.DB,
      { actorUserId: c.get("user")!.id, action: to === "rejected" ? "request.reject" : "request.remove", entity: "request", entityId: r.id, data: { from: r.status }, now },
      { requestId: r.id, status: to, updatedAt: now },
    ),
  ]);
  const outcome = batch.read(results);
  if (!outcome.request) return null;
  const tallies = [await notifyNotSelected(c.env, outcome.notSelected), await notifyInviteExpired(c.env, outcome.expired)];
  return { request: outcome.request, mailFailed: tallies.some((t) => t.failed > 0) };
}

export function registerAdminRequestRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/admin/requests", requireAdmin, async (c) => {
    const raw = c.req.query("status");
    const status = raw === "all" ? null : (REQUEST_STATUSES as readonly string[]).includes(raw ?? "") ? (raw as RequestStatus) : "submitted";
    const items = await listRequestsForAdmin(c.env.DB, status);
    return page(c, <AdminRequestsPage locale={c.get("locale")} origin={requestOrigin(c)} status={status} items={items} />);
  });

  onLocalized(app, "get", "/admin/requests/:id", requireAdmin, async (c) => {
    const item = await findAdminRequest(c.env.DB, c.req.param("id") ?? "");
    return item ? detailPage(c, item) : errorResponse(c, "notFound", 404);
  });

  onLocalized(app, "post", "/admin/requests/:id/invite", requireAdmin, invite);

  // Spec §5.5: return to the client with a required reason, which the client receives by e-mail.
  onLocalized(app, "post", "/admin/requests/:id/reject", requireAdmin, async (c) => {
    const item = await findAdminRequest(c.env.DB, c.req.param("id") ?? "");
    if (!item) return errorResponse(c, "notFound", 404);
    if (!requestTransition(item.request.status, "reject", "admin").ok) return errorResponse(c, "conflict", 409);
    const body = await c.req.parseBody();
    const note = parseAdminNote(body.note);
    if (!note.ok) return detailPage(c, item, { noteError: true, values: { note: typeof body.note === "string" ? body.note : "" } }, 400);
    const ended = await end(c, item, "rejected", note.note);
    if (!ended) return errorResponse(c, "conflict", 409);
    const mailed = await notifyRequestRejected(c.env, ended.request.id);
    const ok = mailed === "sent" && !ended.mailFailed;
    return c.redirect(localizedPath(c.get("locale"), `/admin/requests/${ended.request.id}?done=${ok ? "1" : "mail_failed"}`), 303);
  });

  // Spec §5.5: spam. The client is not told; builders with an open or answered invitation are (not_selected / expired).
  onLocalized(app, "post", "/admin/requests/:id/remove", requireAdmin, async (c) => {
    const item = await findAdminRequest(c.env.DB, c.req.param("id") ?? "");
    if (!item) return errorResponse(c, "notFound", 404);
    if (!requestTransition(item.request.status, "remove", "admin").ok) return errorResponse(c, "conflict", 409);
    if (!(await end(c, item, "removed", null))) return errorResponse(c, "conflict", 409);
    return c.redirect(localizedPath(c.get("locale"), "/admin/requests"), 303);
  });
}
