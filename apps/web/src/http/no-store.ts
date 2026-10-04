import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../env.ts";
import { localeFromPath } from "../i18n/locales.ts";

const PRIVATE = /^\/(hub|me|admin)(\/|$)/;

/** Pages with personal data must never be stored by browsers or shared caches. */
export const noStorePrivate: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();
  if (PRIVATE.test(localeFromPath(c.req.path).rest)) c.header("Cache-Control", "no-store");
};
