import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import { errorResponse } from "../views/error-response.tsx";
import { readSessionCookie } from "./cookies.ts";
import { getSessionUser } from "./sessions.ts";

export const sessionMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const raw = readSessionCookie(c);
  c.set("user", raw ? await getSessionUser(c.env.DB, raw, new Date()) : null);
  await next();
};

function toLogin(c: Parameters<MiddlewareHandler<AppEnv>>[0]) {
  const target = `/login?next=${encodeURIComponent(c.req.path)}`;
  return c.redirect(localizedPath(c.get("locale"), target), 303);
}

export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get("user")) return toLogin(c);
  await next();
};

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get("user");
  if (!user) return toLogin(c);
  if (!user.isAdmin) return errorResponse(c, "forbidden", 403);
  await next();
};
