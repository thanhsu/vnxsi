/**
 * Anonymous visitor identity for product statistics (addendum 2.2, spec 8.11; Owner (b) 2026-10-05). Pure: no Hono, no D1.
 * The cookie value is a random id with no link to a person. `visitorHash` mixes it with a secret that changes every UTC day, so
 * two days cannot be joined. Web Crypto only (`crypto.subtle`, `crypto.getRandomValues`).
 */

export const VISITOR_COOKIE = "__Host-vnx_vid";
export const VISITOR_ID_RE = /^[0-9a-f]{32}$/;
/** Floor for Max-Age so a cookie set a moment before 00:00 UTC is still sent back at least once. */
export const VISITOR_COOKIE_MIN_AGE = 60;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const encoder = new TextEncoder();

/** Seconds until the next 00:00 UTC (86400 at exactly 00:00:00), never below VISITOR_COOKIE_MIN_AGE. */
export function visitorCookieMaxAge(now: Date): number {
  const nextMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(VISITOR_COOKIE_MIN_AGE, Math.ceil((nextMidnight - now.getTime()) / 1000));
}

/** The id when it has exactly the shape newVisitorId makes, else null (never trust a cookie). */
export function parseVisitorCookie(value: string | null | undefined): string | null {
  return typeof value === "string" && VISITOR_ID_RE.test(value) ? value : null;
}

/** 16 random bytes as 32 lower-case hex characters. */
export function newVisitorId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** True for `Sec-GPC: 1` only (Global Privacy Control). */
export function hasGpc(headers: { get(name: string): string | null }): boolean {
  return headers.get("Sec-GPC")?.trim() === "1";
}

async function hmac(key: BufferSource, message: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, encoder.encode(message));
}

/**
 * `hex(HMAC-SHA256(dayKey, visitorId))` with `dayKey = HMAC-SHA256(salt, day)`; `day` is the UTC date `YYYY-MM-DD` (see `utcDay`).
 * Null when there is no salt (unset, empty or blank) or the id is not a valid cookie value: the caller then does not count.
 * Throws on a malformed `day`.
 */
export async function visitorHash(salt: string | undefined, day: string, visitorId: string): Promise<string | null> {
  if (!DAY_RE.test(day)) throw new Error(`invalid day: ${day}`);
  if (!salt || salt.trim() === "" || !VISITOR_ID_RE.test(visitorId)) return null;
  const dayKey = await hmac(encoder.encode(salt), day);
  return [...new Uint8Array(await hmac(dayKey, visitorId))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface CountContext {
  isBot: boolean;
  /** Our team: the same predicate as the /admin guard (`isStaff`). */
  isStaff: boolean;
  /** The signed-in user is the builder of this product. */
  isOwnBuilder: boolean;
  /** The request carries `Sec-GPC: 1`. */
  isGpc: boolean;
  /** `ANALYTICS_SALT` is set and not blank. */
  hasSalt: boolean;
}

/** One rule for views and clicks: count only a real, non-opted-out visitor who is neither the product's builder nor our team, and only with a salt. */
export function shouldCount(ctx: CountContext): boolean {
  return ctx.hasSalt && !ctx.isBot && !ctx.isStaff && !ctx.isOwnBuilder && !ctx.isGpc;
}
