import type { MiddlewareHandler } from "hono";
import { findBuilderByUserId } from "../db/builders.ts";
import type { AppEnv } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import { errorResponse } from "../views/error-response.tsx";
import { adminEmails } from "./admin.ts";
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
  const url = new URL(c.req.url);
  const target = `/login?next=${encodeURIComponent(url.pathname + url.search)}`;
  return c.redirect(localizedPath(c.get("locale"), target), 303);
}

export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get("user")) return toLogin(c);
  await next();
};

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get("user");
  if (!user) return toLogin(c);
  // ADMIN_EMAILS is the source of truth: removing an e-mail revokes access on the next request.
  if (!user.isAdmin || !adminEmails(c.env).has(user.email)) return errorResponse(c, "forbidden", 403);
  await next();
};

/** Loads the signed-in user's builder row; users without one go to the application form. */
export const requireBuilder: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get("user");
  if (!user) return toLogin(c);
  const builder = await findBuilderByUserId(c.env.DB, user.id);
  if (!builder) return c.redirect(localizedPath(c.get("locale"), "/hub/apply"), 303);
  c.set("builder", builder);
  await next();
};
