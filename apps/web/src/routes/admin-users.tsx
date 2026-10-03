import type { Context, Hono } from "hono";
import { requireAdmin } from "../auth/middleware.ts";
import { deleteUserSessions } from "../auth/sessions.ts";
import { writeAudit } from "../db/audit.ts";
import { findUserById, searchUsers, setUserStatus } from "../db/users.ts";
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
    const users = await searchUsers(c.env.DB, query);
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
  if (!(await setUserStatus(c.env.DB, { id: target.id, from: target.status, to: next.status, now }))) return errorResponse(c, "conflict", 409);
  if (action === "suspend") await deleteUserSessions(c.env.DB, target.id);
  await writeAudit(c.env.DB, { actorUserId: admin.id, action: `user.${action}`, entity: "user", entityId: target.id, data: { from: target.status, to: next.status }, now });
  return c.redirect(localizedPath(c.get("locale"), `/admin/users?q=${encodeURIComponent(target.email)}`), 303);
}
