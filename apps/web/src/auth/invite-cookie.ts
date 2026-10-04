import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { AppEnv } from "../env.ts";

/** Holds the SHA-256 of an invite code for 1 hour (spec §5.3). Never the raw code. */
export const INVITE_COOKIE = "__Host-vnx_invite";
const HASH = /^[0-9a-f]{64}$/;

export function readInviteCookie(c: Context<AppEnv>): string | null {
  const value = getCookie(c, INVITE_COOKIE);
  return value && HASH.test(value) ? value : null;
}

export function writeInviteCookie(c: Context<AppEnv>, codeHash: string) {
  setCookie(c, INVITE_COOKIE, codeHash, { path: "/", secure: true, httpOnly: true, sameSite: "Lax", maxAge: 3600 });
}

export function clearInviteCookie(c: Context<AppEnv>) {
  deleteCookie(c, INVITE_COOKIE, { path: "/", secure: true });
}
