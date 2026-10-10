import { env } from "cloudflare:workers";
import { resetFlagCache } from "../src/db/flags.ts";
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

/**
 * VNX-0807: asserts a server-rendered form re-render carries the shared error pattern.
 * `ids` are the input ids the summary must link to, in order; `formLevel` is how many summary items link to no field.
 * Returns the summary markup so a test can look at the text too.
 */
export function expectErrorSummary(html: string, ids: readonly string[], opts: { formLevel?: number; titlePrefix?: string } = {}): string {
  const prefix = opts.titlePrefix ?? "Error:";
  const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? "";
  if (!title.startsWith(`${prefix} `)) throw new Error(`title does not start with "${prefix} ": ${title}`);
  const sections = [...html.matchAll(/<section\b[^>]*\bid="form-errors"[^>]*>([\s\S]*?)<\/section>/g)];
  if (sections.length !== 1) throw new Error(`expected exactly one #form-errors section, found ${sections.length}`);
  const open = sections[0]![0].slice(0, sections[0]![0].indexOf(">") + 1);
  if (!/\btabindex="-1"/.test(open) || !/\bautofocus(=""|\s|>)/.test(open)) throw new Error(`summary lacks tabindex="-1" autofocus: ${open}`);
  if (!/aria-labelledby="form-errors-title"/.test(open) || !/<h2 id="form-errors-title">[^<]+<\/h2>/.test(sections[0]![1]!)) throw new Error("summary lacks its heading");
  if ((html.match(/\bautofocus\b/g) ?? []).length !== 1) throw new Error("expected exactly one autofocus on the page");
  const body = sections[0]![1]!;
  const links = [...body.matchAll(/<a href="#([^"]+)">/g)].map((m) => m[1]!);
  if (links.join(",") !== ids.join(",")) throw new Error(`summary links ${links.join(",")} != ${ids.join(",")}`);
  for (const id of links) if (!new RegExp(`\\sid="${id}"`).test(html)) throw new Error(`summary links to #${id}, which is not on the page`);
  const items = [...body.matchAll(/<li>/g)].length;
  if (items !== ids.length + (opts.formLevel ?? 0)) throw new Error(`summary has ${items} items, expected ${ids.length + (opts.formLevel ?? 0)}`);
  if (/\bundefined\b/.test(body)) throw new Error("summary contains the word undefined");
  if (/role="alert"/.test(html)) throw new Error('page still has role="alert"');
  return body;
}

/**
 * VNX-2702a: counts the D1 queries a request makes. Returns a proxy of `env` (testEnv is not touched) to pass to `createApp().request`,
 * and `queries()`. Each `first`/`all`/`run`/`raw` counts 1 and `batch([...n statements])` counts n. Resets the 60 s flag cache first so
 * the first flag read of the request is counted like a cold isolate's. Only the `DB` binding is wrapped.
 */
export function countD1Queries(base: Bindings = testEnv): { env: Bindings; queries: () => number } {
  resetFlagCache();
  let n = 0;
  // db.batch needs the real statement objects, so each counting proxy remembers its target.
  const unwrap = new WeakMap<object, D1PreparedStatement>();
  const countStatement = (stmt: D1PreparedStatement): D1PreparedStatement => {
    const proxy: D1PreparedStatement = new Proxy(stmt, {
      get(target, prop) {
        const value = Reflect.get(target, prop, target) as unknown;
        if (prop === "bind" && typeof value === "function") return (...args: unknown[]) => countStatement((value as (...a: unknown[]) => D1PreparedStatement).apply(target, args));
        if ((prop === "first" || prop === "all" || prop === "run" || prop === "raw") && typeof value === "function") {
          return (...args: unknown[]) => {
            n++;
            return (value as (...a: unknown[]) => unknown).apply(target, args);
          };
        }
        return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(target) : value;
      },
    });
    unwrap.set(proxy, stmt);
    return proxy;
  };
  const db = new Proxy(base.DB, {
    get(target, prop) {
      const value = Reflect.get(target, prop, target) as unknown;
      if (prop === "prepare" && typeof value === "function") return (sql: string) => countStatement((value as (q: string) => D1PreparedStatement).call(target, sql));
      if (prop === "batch" && typeof value === "function") {
        return (statements: D1PreparedStatement[]) => {
          n += statements.length;
          return (value as (s: D1PreparedStatement[]) => unknown).call(target, statements.map((s) => unwrap.get(s) ?? s));
        };
      }
      return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(target) : value;
    },
  });
  return { env: { ...base, DB: db as D1Database }, queries: () => n };
}
