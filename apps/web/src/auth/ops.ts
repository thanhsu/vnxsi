import type { Context, MiddlewareHandler } from "hono";
import { findOpsAccess } from "../db/ops-members.ts";
import { can, resolveRole, type OpsCapability, type OpsRole } from "../domain/ops.ts";
import { isStaffSession } from "../domain/identity.ts";
import type { AppEnv, Bindings } from "../env.ts";
import { ErrorPage } from "../views/ErrorPage.tsx";
import { page } from "../views/render.ts";
import type { SessionUser } from "./sessions.ts";
import { adminEmails } from "./admin.ts";

/**
 * The Ops console guard and HTTP contract (VNX-2502; spec §3.2, §5; ADR-010 §4). Every refusal under /ops, and every
 * path there that does not exist, is the same 404: no redirect to /login, no 403, nothing that says Ops exists.
 */

/**
 * The one denial response under /ops. The English 404 page, rendered as if for "/" so neither the body nor its
 * language links echo the requested path: an unknown path and a refused one are byte-for-byte the same.
 */
export function opsNotFound(c: Context<AppEnv>): Promise<Response> {
  const origin = new URL(c.req.url).origin;
  // A plain call rather than JSX keeps this module a .ts file, as planned.
  return page(c, ErrorPage({ locale: "en", origin, rest: "/", kind: "notFound", reference: c.get("requestId") }), 404);
}

/**
 * The signed-in user's Ops role, read from D1 on every call (spec §3.2): the user must exist and be active; an e-mail
 * in ADMIN_EMAILS is the root Owner; otherwise the member role, if any. `users.is_admin` plays no part.
 */
export async function resolveOpsRole(env: Pick<Bindings, "DB" | "ADMIN_EMAILS">, user: SessionUser | null): Promise<OpsRole | null> {
  if (!user) return null;
  const access = await findOpsAccess(env.DB, user.id);
  if (!access) return null;
  return resolveRole({ ...access, adminEmails: adminEmails(env) });
}

/** Lets the request through only for a role holding `capability`, and sets `opsRole`; anyone else gets opsNotFound. */
export function requireOps(capability: OpsCapability): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = c.get("user");
    // An OAuth session is never staff (ADR-012 §6): the same sealed 404 as every other denial. Checked here, not in resolveOpsRole.
    if (!user || !isStaffSession(user.method)) return opsNotFound(c);
    const role = await resolveOpsRole(c.env, user);
    if (!role || !can(role, capability)) return opsNotFound(c);
    c.set("opsRole", role);
    await next();
  };
}

/** For /ops and /ops/*: whatever the outcome (200, 3xx, 404, 409, 500), the response is never stored and never indexed. */
export const opsHeaders: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
  c.header("X-Robots-Tag", "noindex, nofollow");
};
