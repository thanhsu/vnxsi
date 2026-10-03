import type { Handler, Hono, MiddlewareHandler } from "hono";
import type { AppEnv } from "../env.ts";
import { LOCALES, localizedPath } from "../i18n/locales.ts";

type AnyHandler = Handler<AppEnv> | MiddlewareHandler<AppEnv>;

/** Registers the same handlers under all four locale prefixes. */
export function onLocalized(app: Hono<AppEnv>, method: "get" | "post", path: string, ...handlers: AnyHandler[]) {
  for (const locale of LOCALES) {
    app.on(method.toUpperCase(), localizedPath(locale, path), ...(handlers as [Handler<AppEnv>]));
  }
}
