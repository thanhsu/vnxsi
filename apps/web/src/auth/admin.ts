import type { Bindings } from "../env.ts";
import type { SessionUser } from "./sessions.ts";

export function adminEmails(env: Pick<Bindings, "ADMIN_EMAILS">): Set<string> {
  return new Set(
    (env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** The /admin guard predicate. ADMIN_EMAILS is the source of truth (removing an e-mail revokes access on the next request). Never widened. */
export function isAdminUser(user: Pick<SessionUser, "email" | "isAdmin"> | null | undefined, env: Pick<Bindings, "ADMIN_EMAILS">): boolean {
  return !!user && user.isAdmin && adminEmails(env).has(user.email);
}
