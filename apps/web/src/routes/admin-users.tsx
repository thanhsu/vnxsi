import type { Context, Hono } from "hono";
import { adminEmails } from "../auth/admin.ts";
import { requireAdmin } from "../auth/middleware.ts";
import { deleteUserSessionsStatement } from "../auth/sessions.ts";
import { auditStatement, inviteExpiryAuditStatements } from "../db/audit.ts";
import { endRequestBatch, expireInvitesOfInactiveBuildersStatement, expiredInvites, listOpenClientRequests } from "../db/requests.ts";
import { findUserById, searchUsers, setUserStatusStatement } from "../db/users.ts";
import { userTransition, type UserAction } from "../domain/user.ts";
import type { AppEnv } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import { notifyInviteExpired, notifyNotSelected } from "../notify/request.ts";
import { UsersPage } from "../views/admin/UsersPage.tsx";
import { errorResponse } from "../views/error-response.tsx";
import { page } from "../views/render.ts";

export function registerUserAdminRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/admin/users", requireAdmin, async (c) => {
    const query = (c.req.query("q") ?? "").slice(0, 254);
    // ADMIN_EMAILS is the source of truth; a stale is_admin flag must not show as admin.
    const admins = adminEmails(c.env);
    const users = (await searchUsers(c.env.DB, query)).map((u) => ({ ...u, isAdmin: u.isAdmin && admins.has(u.email.toLowerCase()) }));
    return page(c, <UsersPage locale={c.get("locale")} origin={requestOrigin(c)} query={query} users={users} currentUserId={c.get("user")!.id} />);
  });
  onLocalized(app, "post", "/admin/users/:id/suspend", requireAdmin, (c) => changeUser(c, "suspend"));
  onLocalized(app, "post", "/admin/users/:id/unsuspend", requireAdmin, (c) => changeUser(c, "unsuspend"));
}

/** Spec §8.2: a suspended user can't sign in and loses every session; their builder profile hides. */
async function changeUser(c: Context<AppEnv>, action: UserAction) {
  const admin = c.get("user")!;
  const target = await findUserById(c.env.DB, c.req.param("id") ?? "");
  if (!target) return errorResponse(c, "notFound", 404);
  if (target.id === admin.id) return errorResponse(c, "conflict", 409);
  const next = userTransition(target.status, action);
  if (!next.ok) return errorResponse(c, "conflict", 409);
  const now = new Date().toISOString();
  // One transaction: status, session purge, invitation sweep, the end of the user's own open requests and the audit rows
  // commit together. Each is guarded on the new status or on its own compare-and-set, so a lost compare-and-set (0 rows
  // changed) writes no audit row. Spec §8.2 / M6 review F7 (Owner): a suspended client's open requests end as `removed`.
  const audit = { actorUserId: admin.id, action: `user.${action}`, entity: "user", entityId: target.id, data: { from: target.status, to: next.status }, now };
  const openRequests = action === "suspend" ? await listOpenClientRequests(c.env.DB, target.id) : [];
  const ends = openRequests.map((r) => ({ id: r.id, from: r.status, batch: endRequestBatch(c.env.DB, { id: r.id, from: r.status, to: "removed", now }) }));
  const statements: D1PreparedStatement[] = [setUserStatusStatement(c.env.DB, { id: target.id, from: target.status, to: next.status, now })];
  if (action === "suspend") statements.push(deleteUserSessionsStatement(c.env.DB, target.id), expireInvitesOfInactiveBuildersStatement(c.env.DB, now, target.id));
  const firstEnd = statements.length;
  for (const e of ends) {
    statements.push(
      ...e.batch.statements,
      auditStatement(c.env.DB, { actorUserId: admin.id, action: "request.remove", entity: "request", entityId: e.id, data: { from: e.from, reason: "user_suspended" }, now }, { requestId: e.id, status: "removed", updatedAt: now }),
    );
  }
  statements.push(auditStatement(c.env.DB, audit, { userId: target.id, status: next.status, updatedAt: now }));
  const results = await c.env.DB.batch(statements);
  if (action === "suspend" && results[0]?.meta.changes === 1) {
    // Spec §7: the swept invitations were expired by this batch (`updated_at = now`); each gets its guarded audit row.
    const expired = expiredInvites(results[2]);
    if (expired.length > 0) await c.env.DB.batch(inviteExpiryAuditStatements(c.env.DB, expired, { actorUserId: admin.id, reason: "builder_inactive", now }));
  }
  // After the commit: builders learn their invitation ended or their proposal was not selected (public builders only). The client is told nothing.
  let offset = firstEnd;
  for (const e of ends) {
    const outcome = e.batch.read(results.slice(offset, offset + e.batch.statements.length));
    offset += e.batch.statements.length + 1;
    if (!outcome.request) continue;
    await notifyNotSelected(c.env, outcome.notSelected);
    await notifyInviteExpired(c.env, outcome.expired);
  }
  if (results[0]?.meta.changes !== 1) return errorResponse(c, "conflict", 409);
  return c.redirect(localizedPath(c.get("locale"), `/admin/users?q=${encodeURIComponent(target.email)}`), 303);
}
