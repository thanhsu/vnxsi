import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../env.ts";
import { localeFromPath } from "./locales.ts";

export const localeMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set("locale", localeFromPath(c.req.path).locale);
  await next();
};
