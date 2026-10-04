import { env } from "cloudflare:workers";
import type { Bindings } from "../src/env.ts";

export const testEnv = env as unknown as Bindings;

export function formPost(path: string, fields: Record<string, string | string[]>, headers: Record<string, string> = {}) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    for (const v of Array.isArray(value) ? value : [value]) body.append(key, v);
  }
  return new Request(`https://vnx.si${path}`, {
    method: "POST",
    headers: { origin: "https://vnx.si", "content-type": "application/x-www-form-urlencoded", ...headers },
    body,
  });
}

export function getReq(path: string, cookie?: string) {
  return new Request(`https://vnx.si${path}`, { headers: cookie ? { cookie } : {} });
}

/** Value of a cookie set by the response, or null. */
export function setCookieValue(res: Response, name: string): string | null {
  for (const line of res.headers.getSetCookie()) {
    if (line.startsWith(`${name}=`)) return line.slice(name.length + 1).split(";")[0] ?? "";
  }
  return null;
}

type RequestApp = { request: (input: Request, init: undefined, env: Bindings) => Response | Promise<Response> };

/** Opens a magic link the way a person does (VNX-0506): GET the confirmation page, then press its button. */
export async function followMagicLink(app: RequestApp, link: string, env: Bindings = testEnv): Promise<Response> {
  const url = new URL(link, "https://vnx.si");
  const shown = await app.request(new Request(url.toString()), undefined, env);
  if (shown.status !== 200) return shown;
  const fields: Record<string, string> = { t: url.searchParams.get("t") ?? "" };
  const next = url.searchParams.get("next");
  if (next) fields.next = next;
  return app.request(formPost("/auth/verify", fields), undefined, env);
}
