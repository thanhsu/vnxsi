import { env } from "cloudflare:workers";
import type { Bindings } from "../src/env.ts";

export const testEnv = env as unknown as Bindings;

export function formPost(path: string, fields: Record<string, string>, headers: Record<string, string> = {}) {
  return new Request(`https://vnx.si${path}`, {
    method: "POST",
    headers: { origin: "https://vnx.si", "content-type": "application/x-www-form-urlencoded", ...headers },
    body: new URLSearchParams(fields),
  });
}
