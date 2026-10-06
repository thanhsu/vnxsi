import type { Context } from "hono";
import type { Child } from "hono/jsx";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppEnv } from "../env.ts";
import { withPrivacyNoticeRequest } from "./privacy-notice.tsx";

/** Renders a JSX page with a doctype. The single render choke point: it also hands Layout the request's privacy-notice data. */
export async function page(c: Context<AppEnv>, node: unknown, status: ContentfulStatusCode = 200): Promise<Response> {
  const resolved = await node;
  const html = String(withPrivacyNoticeRequest({ goLive: c.env.PRIVACY_NOTICE_GO_LIVE, now: new Date() }, resolved as Child));
  return c.html("<!DOCTYPE html>" + html, status);
}
