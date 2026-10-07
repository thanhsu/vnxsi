import type { Bindings } from "../env.ts";
import { isAdminUser } from "./admin.ts";
import { resolveOpsRole } from "./ops.ts";
import type { SessionUser } from "./sessions.ts";

/**
 * "Our team" for product statistics: such visitors are never counted. Async so call sites already await it. It is the /admin guard
 * (`isAdminUser`) or any Ops member of any role, Viewer included (`resolveOpsRole`, the same D1 lookup as the /ops guard). Do not widen
 * `requireAdmin`. Call it only for a signed-in user and after the cheap checks (bot, GPC, salt): the Ops lookup is one D1 read.
 */
export async function isStaff(env: Pick<Bindings, "DB" | "ADMIN_EMAILS">, user: SessionUser | null | undefined): Promise<boolean> {
  if (!user) return false;
  return isAdminUser(user, env) || (await resolveOpsRole(env, user)) !== null;
}
