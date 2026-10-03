import type { Bindings } from "../env.ts";

export function adminEmails(env: Pick<Bindings, "ADMIN_EMAILS">): Set<string> {
  return new Set(
    (env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}
