import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppEnv } from "../env.ts";
import { localeFromPath } from "../i18n/locales.ts";
import { ErrorPage, type ErrorKind } from "./ErrorPage.tsx";
import { page } from "./render.ts";

export function errorResponse(c: Context<AppEnv>, kind: ErrorKind, status: ContentfulStatusCode) {
  const url = new URL(c.req.url);
  const { locale, rest } = localeFromPath(url.pathname);
  return page(c, <ErrorPage locale={locale} origin={url.origin} rest={rest} kind={kind} reference={c.get("requestId")} />, status);
}
