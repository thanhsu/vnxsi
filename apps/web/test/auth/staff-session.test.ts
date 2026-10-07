import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { readFlags, resetFlagCache } from "../../src/db/flags.ts";
import { isStaffSession, SESSION_METHODS } from "../../src/domain/identity.ts";
import { makeBuilder, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const SOURCES = import.meta.glob("../../src/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
/** A source file with LF endings: src/auth/*.ts are CRLF on disk (core.autocrlf) and ?raw keeps the bytes (cf. test/legal/content.test.ts). */
function source(path: string): string {
  const raw = SOURCES[`../../src/${path}`];
  expect(raw, path).toBeDefined();
  return (raw as string).replace(/\r\n/g, "\n");
}
const OAUTH_METHODS = SESSION_METHODS.filter((m) => m !== "magic_link");
const tag = () => crypto.randomUUID().slice(0, 8);

const app = () => createApp();
/** Status, headers and body with the request id (cf-ray) removed. */
async function seen(req: (ray: string) => Request) {
  const ray = `ray-${tag()}`;
  const res = await app().request(req(ray), undefined, testEnv);
  return { status: res.status, headers: [...res.headers.entries()].sort(), body: (await res.text()).replaceAll(ray, "") };
}
const get = (path: string, cookie: string) => (ray: string) => new Request(`https://vnx.si${path}`, { headers: { cookie, "cf-ray": ray } });
const post = (path: string, cookie: string) => (ray: string) => formPost(path, { enabled: "1" }, { cookie, "cf-ray": ray });

describe("isStaffSession", () => {
  it("accepts magic_link and nothing else", () => {
    expect(isStaffSession("magic_link")).toBe(true);
    for (const method of OAUTH_METHODS) expect(isStaffSession(method), method).toBe(false);
  });
});

describe("/admin refuses oauth_* sessions (decision 9)", () => {
  it("denies an ADMIN_EMAILS admin with an oauth_* session exactly like a signed-in non-admin: 403, same bytes", async () => {
    const plain = await signIn(`staff-plain-${tag()}@vnx.si`);
    const magic = await signIn("owner@vnx.si", { admin: true });
    // Control: the same admin through a magic link is let in (GET /admin redirects to /admin/builders).
    expect((await app().request(getReq("/admin", magic.cookie), undefined, testEnv)).status).toBe(303);
    for (const path of ["/admin", "/admin/flags", "/admin/builders"]) {
      const reference = await seen(get(path, plain.cookie));
      expect(reference.status, path).toBe(403);
      for (const method of OAUTH_METHODS) {
        const oauth = await signIn("owner@vnx.si", { admin: true, method });
        expect(await seen(get(path, oauth.cookie)), `${method} ${path}`).toEqual(reference);
      }
    }
  });

  it("refuses an admin POST with an oauth_* session and changes nothing", async () => {
    const oauth = await signIn("owner@vnx.si", { admin: true, method: "oauth_github" });
    const target = await signIn(`staff-target-${tag()}@vnx.si`);
    await testEnv.DB.prepare("DELETE FROM feature_flags").run();
    resetFlagCache();
    const audits = () => testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE actor_user_id = ?1").bind(oauth.user.id).first<{ n: number }>();
    const before = await audits();
    expect((await seen(post("/admin/flags/affiliate", oauth.cookie))).status).toBe(403);
    expect((await readFlags(testEnv.DB)).affiliate).toBe(false);
    expect((await seen(post(`/admin/users/${target.user.id}/suspend`, oauth.cookie))).status).toBe(403);
    const row = await testEnv.DB.prepare("SELECT status FROM users WHERE id = ?1").bind(target.user.id).first<{ status: string }>();
    expect(row?.status).toBe("active");
    expect((await audits())?.n).toBe(before?.n);
  });
});

describe("non-staff routes are unchanged for oauth_* sessions", () => {
  it("serves /me, /hub and public pages", async () => {
    const email = `staff-user-${tag()}@vnx.si`;
    await makeBuilder(email, `staff-${tag()}`, "approved");
    for (const method of OAUTH_METHODS) {
      const { cookie } = await signIn(email, { method });
      for (const path of ["/me", "/hub", "/", "/login"]) {
        const res = await app().request(getReq(path, cookie), undefined, testEnv);
        expect(res.status, `${method} ${path}`).toBe(200);
      }
    }
  });
});

describe("where the method check lives (decision 9, R4, F7)", () => {
  /** The text of a top-level function or const, from its start to the first line that is just `}` or `};`. */
  function block(file: string, start: RegExp): string {
    const src = source(file);
    const at = src.search(start);
    expect(at, `${file} ${start}`).toBeGreaterThanOrEqual(0);
    const rest = src.slice(at);
    const end = rest.search(/\n\};?\n/);
    expect(end, `${file} ${start}: terminator not found`).toBeGreaterThan(0);
    return rest.slice(0, end + 3);
  }

  it("the two guards call isStaffSession; the resolver, the admin e-mail helper and requireUser never read the method", () => {
    const ops = block("auth/ops.ts", /export function requireOps/);
    expect(ops).toContain("isStaffSession(");
    expect(ops.indexOf("isStaffSession(")).toBeLessThan(ops.indexOf("resolveOpsRole("));
    expect(block("auth/middleware.ts", /export const requireAdmin/)).toContain("isStaffSession(");
    expect(block("auth/ops.ts", /export async function resolveOpsRole/)).not.toMatch(/method/i);
    expect(block("auth/middleware.ts", /export const requireUser/)).not.toMatch(/method|isStaffSession/);
    expect(source("auth/admin.ts")).not.toMatch(/method|isStaffSession/);
  });

  // Tripwire: a new legitimate caller of isStaffSession needs Reviewer sign-off (it changes who counts as staff).
  it("no other file decides staff access from the session method", () => {
    const users = Object.entries(SOURCES).filter(([, src]) => src.includes("isStaffSession"));
    expect(users.map(([f]) => f.replace("../../src/", "")).sort()).toEqual(["auth/middleware.ts", "auth/ops.ts", "domain/identity.ts"]);
  });
});
