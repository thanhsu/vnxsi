import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { AppEnv } from "../env.ts";
import { SESSION_TTL_MS } from "./sessions.ts";

export const SESSION_COOKIE = "__Host-vnx_session";

export function readSessionCookie(c: Context<AppEnv>): string | null {
  return getCookie(c, SESSION_COOKIE) ?? null;
}

export function writeSessionCookie(c: Context<AppEnv>, value: string) {
  setCookie(c, SESSION_COOKIE, value, { path: "/", secure: true, httpOnly: true, sameSite: "Lax", maxAge: SESSION_TTL_MS / 1000 });
}

export function clearSessionCookie(c: Context<AppEnv>) {
  deleteCookie(c, SESSION_COOKIE, { path: "/", secure: true });
}
