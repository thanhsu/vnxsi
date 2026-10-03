import type { Handler, Hono, MiddlewareHandler } from "hono";
import type { AppEnv } from "../env.ts";
import { DEFAULT_LOCALE, LOCALES, localizedPath } from "../i18n/locales.ts";

type AnyHandler = Handler<AppEnv> | MiddlewareHandler<AppEnv>;

/** Registers the same handlers under all four locale prefixes. */
export function onLocalized(app: Hono<AppEnv>, method: "get" | "post", path: string, ...handlers: AnyHandler[]) {
  for (const locale of LOCALES) {
    const route = localizedPath(locale, path);
    app.on(method.toUpperCase(), route, ...(handlers as [Handler<AppEnv>]));
    // Hono routing is strict: also serve the bare prefix (/vi) for the root route.
    if (path === "/" && locale !== DEFAULT_LOCALE) {
      app.on(method.toUpperCase(), route.slice(0, -1), ...(handlers as [Handler<AppEnv>]));
    }
  }
}
