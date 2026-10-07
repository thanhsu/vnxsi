import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { isStaff } from "../auth/staff.ts";
import { type CfLike, isBotRequest } from "../domain/bot.ts";
import { isCountingLive } from "../domain/privacy-notice.ts";
import { VISITOR_COOKIE, hasGpc, newVisitorId, parseVisitorCookie, shouldCount, usableSalt, visitorCookieMaxAge } from "../domain/visitor.ts";
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

export type ViewVisit = { count: false } | { count: true; visitorId: string; isNew: boolean };

/**
 * Whether this `GET /p/:slug` counts as a product view, and under which visitor id (a fresh one when the cookie is missing or malformed).
 * The go-live gate first (Owner 2026-10-06), then the cheap checks (no salt, bot, GPC), then the product's own builder, and `isStaff` last,
 * only for a signed-in non-owner. Never rejects: on any error it logs and says "do not count". It does NOT touch the response.
 */
export async function decideViewVisit(c: Context<AppEnv>, builderId: string, now: Date): Promise<ViewVisit> {
  try {
    if (!isCountingLive(c.env.PRIVACY_NOTICE_GO_LIVE, now)) return { count: false };
    if (usableSalt(c.env.ANALYTICS_SALT) === null) {
      warnNoSaltOnce();
      return { count: false };
    }
    const cf = c.req.raw.cf as CfLike;
    const isBot = isBotRequest(c.req.header("user-agent"), cf);
    const isGpc = hasGpc(c.req.raw.headers);
    if (isBot || isGpc) return { count: false };
    const user = c.get("user");
    const own = user?.id === builderId;
    const staff = !own && user ? await isStaff(c.env, user) : false;
    if (!shouldCount({ isBot, isStaff: staff, isOwnBuilder: own, isGpc, hasSalt: true })) return { count: false };
    const existing = readVisitorCookie(c);
    return existing !== null ? { count: true, visitorId: existing, isNew: false } : { count: true, visitorId: newVisitorId(), isNew: true };
  } catch (err) {
    console.error(JSON.stringify({ event: "product.view_decide_failed", error: String(err) }));
    return { count: false };
  }
}

/** `__Host-vnx_vid`: random id, ends at the next 00:00 UTC. `private` keeps a shared cache from handing one visitor's Set-Cookie to another. */
export function setVisitorCookie(c: Context<AppEnv>, visitorId: string, now: Date): void {
  setCookie(c, VISITOR_COOKIE, visitorId, { path: "/", secure: true, httpOnly: true, sameSite: "Lax", maxAge: visitorCookieMaxAge(now) });
  c.header("Cache-Control", "private");
}
