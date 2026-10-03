import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppEnv } from "../env.ts";

/** Renders a JSX page with a doctype. Accepts sync or async JSX nodes. */
export async function page(c: Context<AppEnv>, node: unknown, status: ContentfulStatusCode = 200): Promise<Response> {
  const html = String(await node);
  return c.html("<!DOCTYPE html>" + html, status);
}
