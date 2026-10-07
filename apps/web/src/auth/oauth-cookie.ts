import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { OAuthProvider } from "../domain/identity.ts";
import { encodeOAuthCookie, OAUTH_FLOW_TTL_MS, parseOAuthCookie, type OAuthCookie } from "../domain/oauth.ts";
import type { AppEnv } from "../env.ts";
import { sha256Hex } from "./crypto.ts";

/**
 * Carries one OAuth round trip: state, PKCE verifier, nonce, intent, next, locale (ADR-012 §1). SameSite=Lax, not Strict: the
 * callback is a top-level GET from the provider and a Strict cookie would not be sent. Used once: the callback clears it.
 */
export const OAUTH_COOKIE = "__Host-vnx_oauth";

/** The cookie as written for `provider`, or null (missing, for another provider, expired, malformed: all the same). */
export function readOAuthCookie(c: Context<AppEnv>, provider: OAuthProvider, now: number = Date.now()): OAuthCookie | null {
  return parseOAuthCookie(getCookie(c, OAUTH_COOKIE), { provider, now });
}

export function writeOAuthCookie(c: Context<AppEnv>, cookie: OAuthCookie, now: number = Date.now()) {
  const maxAge = Math.min(OAUTH_FLOW_TTL_MS / 1000, Math.max(1, Math.ceil((cookie.exp - now) / 1000)));
  setCookie(c, OAUTH_COOKIE, encodeOAuthCookie(cookie), { path: "/", secure: true, httpOnly: true, sameSite: "Lax", maxAge });
}

export function clearOAuthCookie(c: Context<AppEnv>) {
  deleteCookie(c, OAUTH_COOKIE, { path: "/", secure: true });
}

/** What a link intent and a link flow store in place of the session id: `sha256("oauth-link:" + raw session id)` (S1). */
export function linkSessionHash(rawSessionId: string): Promise<string> {
  return sha256Hex(`oauth-link:${rawSessionId}`);
}
