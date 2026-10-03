import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../env.ts";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function originOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/** CSRF defence (spec §8.2): state-changing requests must carry a same-origin Origin header. */
export const originCheck: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!SAFE_METHODS.has(c.req.method)) {
    const origin = c.req.header("origin");
    const allowed = [originOf(c.req.url), originOf(c.env.APP_ORIGIN)];
    if (!origin || !allowed.includes(origin)) return c.text("Forbidden", 403);
  }
  await next();
};
