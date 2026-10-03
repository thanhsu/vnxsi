import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import { errorResponse } from "../views/error-response.tsx";
import { readSessionCookie } from "./cookies.ts";
import { getSessionUser } from "./sessions.ts";

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

export const sessionMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const raw = readSessionCookie(c);
  let user = null;
  if (raw && TOKEN_SHAPE.test(raw)) {
    try {
      user = await getSessionUser(c.env.DB, raw, new Date());
    } catch (err) {
      console.error(JSON.stringify({ requestId: c.get("requestId"), event: "session.lookup_failed", error: String(err) }));
    }
  }
  c.set("user", user);
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
