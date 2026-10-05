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
  type InviteWithBuilder,
  type RequestStatus,
  type Suggestion,
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

/**
 * What the request's detail page shows besides the request, for /admin and /ops (VNX-2504b): its invitations and, while
 * it can take more, the suggested builders with their reasons (`null` = no more invitations: status or full).
 */
export async function requestMatching(db: D1Database, item: AdminRequest): Promise<{ invites: InviteWithBuilder[]; suggestions: Suggestion[] | null }> {
  const invites = await listRequestInvites(db, item.request.id);
  const canInvite = requestTransition(item.request.status, "invite", "admin").ok && item.activeInvites < MAX_ACTIVE_INVITES;
  const since = new Date(Date.now() - EXPIRED_PENALTY_WINDOW_MS).toISOString();
  const suggestions = canInvite ? suggestBuilders(item.request, await listCandidates(db, item.request, since)) : null;
  return { invites, suggestions };
}

async function detailPage(c: Context<AppEnv>, item: AdminRequest, extra: DetailExtra = {}, status: 200 | 400 = 200) {
  const { invites, suggestions } = await requestMatching(c.env.DB, item);
  const done = c.req.query("done");
  const notice = done === "1" ? "done" : done === "mail_failed" ? "mail_failed" : null;
  return page(c, <RequestDetailPage locale={c.get("locale")} origin={requestOrigin(c)} item={item} invites={invites} suggestions={suggestions} notice={notice} {...extra} />, status);
}

const listOf = (value: unknown): string[] => (Array.isArray(value) ? value : value === undefined ? [] : [value]).filter((v): v is string => typeof v === "string" && v !== "");

/** The outcome of a request action, for /admin and /ops (VNX-2504b) to render. `mailed`: every e-mail went out. */
export type RequestDecision =
  | { kind: "not_found" }
  | { kind: "conflict" }
  | { kind: "invalid_invite"; item: AdminRequest; error: InviteError; handle: string }
  | { kind: "invalid_note"; item: AdminRequest; note: string }
  | { kind: "done"; requestId: string; mailed: boolean };

/** /admin's answer to each outcome (unchanged behaviour); `done` redirects to `doneTo`. */
function adminAnswer(c: Context<AppEnv>, r: RequestDecision, doneTo: (r: { requestId: string; mailed: boolean }) => string) {
  if (r.kind === "not_found") return errorResponse(c, "notFound", 404);
  if (r.kind === "conflict") return errorResponse(c, "conflict", 409);
  if (r.kind === "invalid_invite") return detailPage(c, r.item, { inviteError: r.error, values: { handle: r.handle } }, 400);
  if (r.kind === "invalid_note") return detailPage(c, r.item, { noteError: true, values: { note: r.note } }, 400);
  return c.redirect(localizedPath(c.get("locale"), doneTo(r)), 303);
}

const doneDetail = (r: { requestId: string; mailed: boolean }) => `/admin/requests/${r.requestId}?done=${r.mailed ? "1" : "mail_failed"}`;

/**
 * Spec §5.7 step 2: up to 5 active invitations. The checks here only give quick answers; the INSERT in
 * inviteBuildersBatch is the real guard (cap, duplicate, client, eligibility, request status), so a lost race or a forged
 * checkbox invites nobody and answers 409. Shared by /admin and /ops; reads `:id` from the route.
 */
export async function inviteToRequest(c: Context<AppEnv>): Promise<RequestDecision> {
  const item = await findAdminRequest(c.env.DB, c.req.param("id") ?? "");
  if (!item) return { kind: "not_found" };
  if (!requestTransition(item.request.status, "invite", "admin").ok) return { kind: "conflict" };
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
  if (error) return { kind: "invalid_invite", item, error, handle };

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
  if (!outcome.request) return { kind: "conflict" }; // nobody was invited: nothing was written
  const mailed = await notifyInvited(c.env, outcome.invited.map((i) => i.id));
  return { kind: "done", requestId: item.request.id, mailed: mailed.failed === 0 };
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

/** Spec §5.5: return to the client with a required reason, which the client receives by e-mail. Shared by /admin and /ops. */
export async function rejectRequest(c: Context<AppEnv>): Promise<RequestDecision> {
  const item = await findAdminRequest(c.env.DB, c.req.param("id") ?? "");
  if (!item) return { kind: "not_found" };
  if (!requestTransition(item.request.status, "reject", "admin").ok) return { kind: "conflict" };
  const body = await c.req.parseBody();
  const note = parseAdminNote(body.note);
  if (!note.ok) return { kind: "invalid_note", item, note: typeof body.note === "string" ? body.note : "" };
  const ended = await end(c, item, "rejected", note.note);
  if (!ended) return { kind: "conflict" };
  const mailed = await notifyRequestRejected(c.env, ended.request.id);
  return { kind: "done", requestId: ended.request.id, mailed: mailed === "sent" && !ended.mailFailed };
}

/**
 * Spec §5.5: spam. The client is not told; builders with an open or answered invitation are (not_selected / expired).
 * Shared by /admin and /ops.
 */
export async function removeRequest(c: Context<AppEnv>): Promise<RequestDecision> {
  const item = await findAdminRequest(c.env.DB, c.req.param("id") ?? "");
  if (!item) return { kind: "not_found" };
  if (!requestTransition(item.request.status, "remove", "admin").ok) return { kind: "conflict" };
  const ended = await end(c, item, "removed", null);
  if (!ended) return { kind: "conflict" };
  return { kind: "done", requestId: ended.request.id, mailed: !ended.mailFailed };
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

  onLocalized(app, "post", "/admin/requests/:id/invite", requireAdmin, async (c) => adminAnswer(c, await inviteToRequest(c), doneDetail));
  onLocalized(app, "post", "/admin/requests/:id/reject", requireAdmin, async (c) => adminAnswer(c, await rejectRequest(c), doneDetail));
  // After a removal /admin goes back to the queue, without a notice (unchanged).
  onLocalized(app, "post", "/admin/requests/:id/remove", requireAdmin, async (c) => adminAnswer(c, await removeRequest(c), () => "/admin/requests"));
}
