import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../env.ts";
import { localeFromPath } from "../i18n/locales.ts";

const PRIVATE = /^\/(hub|me|admin)(\/|$)/;
const isHtml = (res: Response) => (res.headers.get("content-type") ?? "").startsWith("text/html");

/**
 * Pages with personal data must never be stored by browsers or shared caches: the private areas, and (VNX-0803 F8) any
 * HTML page shown to a signed-in person, since public forms prefill their name or e-mail. Assets and feeds keep their caching.
 */
export const noStorePrivate: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();
  if (PRIVATE.test(localeFromPath(c.req.path).rest) || (c.get("user") !== null && isHtml(c.res))) c.header("Cache-Control", "no-store");
};
