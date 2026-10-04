import type { Context, Hono } from "hono";
import { adminEmails } from "../auth/admin.ts";
import { requireAdmin } from "../auth/middleware.ts";
import { deleteUserSessionsStatement } from "../auth/sessions.ts";
import { auditStatement } from "../db/audit.ts";
import { findUserById, searchUsers, setUserStatusStatement } from "../db/users.ts";
import { userTransition, type UserAction } from "../domain/user.ts";
import type { AppEnv } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
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
  // One transaction: status, session purge and audit commit together. The purge and the audit row are guarded on
  // the new status so a lost compare-and-set (0 rows changed) writes no audit row.
  const audit = { actorUserId: admin.id, action: `user.${action}`, entity: "user", entityId: target.id, data: { from: target.status, to: next.status }, now };
  const statements = [
    setUserStatusStatement(c.env.DB, { id: target.id, from: target.status, to: next.status, now }),
    ...(action === "suspend" ? [deleteUserSessionsStatement(c.env.DB, target.id)] : []),
    auditStatement(c.env.DB, audit, { userId: target.id, status: next.status, updatedAt: now }),
  ];
  const results = await c.env.DB.batch(statements);
  if (results[0]?.meta.changes !== 1) return errorResponse(c, "conflict", 409);
  return c.redirect(localizedPath(c.get("locale"), `/admin/users?q=${encodeURIComponent(target.email)}`), 303);
}
