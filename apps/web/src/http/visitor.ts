import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import { VISITOR_COOKIE, parseVisitorCookie } from "../domain/visitor.ts";
import type { AppEnv } from "../env.ts";

/** The visitor id from the cookie when it has the exact shape, else null. Reads only: the /go/ routes never set the cookie (M2). */
export function readVisitorCookie(c: Context<AppEnv>): string | null {
  return parseVisitorCookie(getCookie(c, VISITOR_COOKIE) ?? null);
}

let warned = false;
/** One warning per isolate when ANALYTICS_SALT is unset or blank (M3): product views and clicks are then not counted. */
export function warnNoSaltOnce(): void {
  if (warned) return;
  warned = true;
  console.warn(JSON.stringify({ event: "visitor.no_salt", note: "ANALYTICS_SALT is not set: product views and clicks are not counted" }));
}

/** For tests only. */
export function resetNoSaltWarning(): void {
  warned = false;
}
