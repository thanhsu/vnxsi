import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { sessionMiddleware } from "../../src/auth/middleware.ts";
import { opsHeaders, opsNotFound, requireOps } from "../../src/auth/ops.ts";
import type { SessionUser } from "../../src/auth/sessions.ts";
import { deleteOpsMemberStatement } from "../../src/db/ops-members.ts";
import { setUserStatusStatement } from "../../src/db/users.ts";
import type { GrantableRole } from "../../src/domain/ops.ts";
import type { AppEnv, Bindings } from "../../src/env.ts";
import { requestBodyLimit } from "../../src/http/body-limit.ts";
import { noStorePrivate } from "../../src/http/no-store.ts";
import { originCheck } from "../../src/http/origin.ts";
import { requestId } from "../../src/http/request-id.ts";
import { securityHeaders } from "../../src/http/security-headers.ts";
import { localeMiddleware } from "../../src/i18n/middleware.ts";
import { errorResponse } from "../../src/views/error-response.tsx";
import { ensureUser, signIn } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

/**
 * VNX-2502 (spec §3.2, §5; ADR-010 §4; plan O1 "Hợp đồng 404 kín"). No real Ops page exists yet, so the guard is
 * exercised on fake routes in a small app that copies the real middleware chain; the real app is used for the
 * catch-all 404 under /ops and for robots/headers.
 */

const tag = () => crypto.randomUUID().slice(0, 8);
const ROOT = "ops-guard-root@vnx.si";
/** A root Owner of our own, so suspending it never touches the suite's shared owner@vnx.si. */
const env = { ...testEnv, ADMIN_EMAILS: `owner@vnx.si, ${ROOT.toUpperCase()}` } as Bindings;

type Opts = { cookie?: string; method?: "GET" | "POST"; ray?: string };

/** Same-origin request; `ray` becomes the request id (cf-ray), so tests can strip it from bodies. */
function req(path: string, opts: Opts = {}): Request {
  const headers: Record<string, string> = { "cf-ray": opts.ray ?? `ray-${tag()}` };
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.method === "POST") {
    headers.origin = "https://vnx.si";
    headers["content-type"] = "application/x-www-form-urlencoded";
    return new Request(`https://vnx.si${path}`, { method: "POST", headers, body: "x=1" });
  }
  return new Request(`https://vnx.si${path}`, { headers });
}

/** The real app's middleware chain, fake guarded routes, then the same /ops catch-all. `asUser` stands in for a stale session. */
function opsApp(asUser?: SessionUser) {
  const app = new Hono<AppEnv>();
  app.use("*", requestId);
  app.use("*", securityHeaders);
  app.use("/ops", opsHeaders);
  app.use("/ops/*", opsHeaders);
  app.use("*", localeMiddleware);
  app.use("*", originCheck);
  app.use("*", requestBodyLimit);
  app.use("*", sessionMiddleware);
  app.use("*", noStorePrivate);
  if (asUser) {
    app.use("*", async (c, next) => {
      c.set("user", asUser);
      await next();
    });
  }
  app.get("/ops/fake", requireOps("marketplace.view"), (c) => c.text(`view:${c.get("opsRole")}`));
  app.post("/ops/fake", requireOps("marketplace.act"), (c) => c.text(`act:${c.get("opsRole")}`));
  app.get("/ops/fake/team", requireOps("team.manage"), (c) => c.text(`team:${c.get("opsRole")}`));
  app.get("/ops/fake/redirect", requireOps("overview.view"), (c) => c.redirect("/ops/fake", 303));
  app.get("/ops/fake/conflict", requireOps("overview.view"), (c) => c.text("conflict", 409));
  app.get("/ops/fake/boom", requireOps("overview.view"), () => {
    throw new Error("boom");
  });
  app.all("/ops", opsNotFound);
  app.all("/ops/*", opsNotFound);
  app.onError((_err, c) => errorResponse(c, "server", 500));
  return app;
}

async function send(app: { request: (r: Request, i: undefined, e: Bindings) => Response | Promise<Response> }, path: string, opts: Opts = {}) {
  const ray = opts.ray ?? `ray-${tag()}`;
  const res = await app.request(req(path, { ...opts, ray }), undefined, env);
  const body = await res.text();
  return { res, body, ray };
}

/** Status, every header and the body with its request id removed: what two denials must share byte for byte. */
async function denial(app: Parameters<typeof send>[0], path: string, opts: Opts = {}) {
  const { res, body, ray } = await send(app, path, opts);
  return { status: res.status, headers: [...res.headers.entries()].sort(), body: body.replaceAll(ray, "") };
}

async function member(email: string, role: GrantableRole) {
  const owner = await ensureUser("owner@vnx.si");
  const { user, cookie } = await signIn(email);
  const now = new Date().toISOString();
  await testEnv.DB.prepare("INSERT INTO ops_members (user_id, role, granted_by, granted_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)").bind(user.id, role, owner.id, now).run();
  return { user, cookie };
}

async function suspend(userId: string) {
  await setUserStatusStatement(testEnv.DB, { id: userId, from: "active", to: "suspended", now: new Date().toISOString() }).run();
}
async function unsuspend(userId: string) {
  await setUserStatusStatement(testEnv.DB, { id: userId, from: "suspended", to: "active", now: new Date().toISOString() }).run();
}

const sessionUser = (u: { id: string; email: string }): SessionUser => ({ id: u.id, email: u.email, locale: "en", isAdmin: false });

describe("sealed 404 under /ops (AC1, spec §5)", () => {
  it("answers the five denials with the same status, headers and body", async () => {
    const real = createApp();
    const fake = opsApp();
    const reference = await denial(real, "/ops/khong-ton-tai");
    expect(reference.status).toBe(404);

    // 1. Not signed in.
    const anonymous = await denial(fake, "/ops/fake");
    // 2. Suspended, although the e-mail is a root Owner in ADMIN_EMAILS (its session no longer resolves).
    const root = await signIn(ROOT);
    expect((await send(fake, "/ops/fake", { cookie: root.cookie })).res.status).toBe(200);
    await suspend(root.user.id);
    const suspended = await denial(fake, "/ops/fake", { cookie: root.cookie });
    // ... and the guard itself refuses a suspended user even when a stale session still names them.
    const suspendedStale = await denial(opsApp(sessionUser(root.user)), "/ops/fake");
    await unsuspend(root.user.id);
    // 3. Signed in, no Ops role.
    const plain = await signIn(`ops-guard-plain-${tag()}@vnx.si`);
    const noRole = await denial(fake, "/ops/fake", { cookie: plain.cookie });
    // 4. A role without the capability (Content has no marketplace.view).
    const content = await member(`ops-guard-content-${tag()}@vnx.si`, "content");
    const lacking = await denial(fake, "/ops/fake", { cookie: content.cookie });
    // 5. A path that does not exist, seen by the root Owner and by an anonymous visitor.
    const missingForOwner = await denial(real, "/ops/khong-ton-tai/con", { cookie: root.cookie });

    for (const [name, got] of Object.entries({ anonymous, suspended, suspendedStale, noRole, lacking, missingForOwner })) {
      expect(got.status, name).toBe(reference.status);
      expect(got.body, name).toBe(reference.body);
      expect(got.headers, name).toEqual(reference.headers);
    }
  });

  it("gives a forged POST the same 404 as a GET", async () => {
    const reference = await denial(createApp(), "/ops/khong-ton-tai");
    const viewer = await member(`ops-guard-viewer-post-${tag()}@vnx.si`, "viewer");
    const plain = await signIn(`ops-guard-plain-post-${tag()}@vnx.si`);
    const cases = {
      viewerPost: await denial(opsApp(), "/ops/fake", { method: "POST", cookie: viewer.cookie }),
      plainPost: await denial(opsApp(), "/ops/fake", { method: "POST", cookie: plain.cookie }),
      anonymousPost: await denial(opsApp(), "/ops/fake", { method: "POST" }),
      realPost: await denial(createApp(), "/ops/marketplace/builders/x/approve", { method: "POST", cookie: viewer.cookie }),
    };
    for (const [name, got] of Object.entries(cases)) {
      expect(got.status, name).toBe(404);
      expect(got.body, name).toBe(reference.body);
      expect(got.headers, name).toEqual(reference.headers);
    }
  });

  it("is the English 404 page, which names neither /ops nor the requested path", async () => {
    const { res, body } = await send(createApp(), "/ops/people/team");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(body).toContain('<html lang="en">');
    expect(body).toContain('<meta name="robots" content="noindex"/>');
    expect(body).not.toContain("/ops");
    expect(body).not.toContain("people/team");
    // CSP (VNX-0803): no inline style or script.
    expect(body).not.toMatch(/\sstyle=/);
    expect(body).not.toMatch(/<script(?![^>]*\ssrc=)[^>]*>/);
  });

  it("opsNotFound is the one denial response: same body for any path", async () => {
    const app = new Hono<AppEnv>();
    app.use("*", requestId);
    app.all("*", opsNotFound);
    const a = await denial(app, "/ops/a");
    const b = await denial(app, "/ops/b/c?x=1");
    expect(a.status).toBe(404);
    expect(b).toEqual(a);
  });
});

describe("allowed roles (AC2, spec §3.2)", () => {
  it("lets the root Owner from ADMIN_EMAILS through, with no member row and no is_admin flag", async () => {
    const root = await signIn(`ops-guard-root2-${tag()}@vnx.si`);
    const rootEnv = { ...env, ADMIN_EMAILS: `${env.ADMIN_EMAILS},${root.user.email}` } as Bindings;
    const app = opsApp();
    expect(await (await app.request(req("/ops/fake", { cookie: root.cookie }), undefined, rootEnv)).text()).toBe("view:owner");
    expect(await (await app.request(req("/ops/fake/team", { cookie: root.cookie }), undefined, rootEnv)).text()).toBe("team:owner");
    expect(await (await app.request(req("/ops/fake", { cookie: root.cookie, method: "POST" }), undefined, rootEnv)).text()).toBe("act:owner");
    // Removing the e-mail from ADMIN_EMAILS revokes it on the next request.
    expect((await app.request(req("/ops/fake", { cookie: root.cookie }), undefined, env)).status).toBe(404);
  });

  it("lets members through by the capability matrix", async () => {
    const app = opsApp();
    const operator = await member(`ops-guard-op-${tag()}@vnx.si`, "operator");
    expect((await send(app, "/ops/fake", { cookie: operator.cookie })).body).toBe("view:operator");
    expect((await send(app, "/ops/fake", { cookie: operator.cookie, method: "POST" })).body).toBe("act:operator");
    expect((await send(app, "/ops/fake/team", { cookie: operator.cookie })).res.status).toBe(404);

    const viewer = await member(`ops-guard-view-${tag()}@vnx.si`, "viewer");
    expect((await send(app, "/ops/fake", { cookie: viewer.cookie })).body).toBe("view:viewer");
    expect((await send(app, "/ops/fake", { cookie: viewer.cookie, method: "POST" })).res.status).toBe(404);

    const content = await member(`ops-guard-cont-${tag()}@vnx.si`, "content");
    expect((await send(app, "/ops/fake/redirect", { cookie: content.cookie })).res.status).toBe(303);
    expect((await send(app, "/ops/fake", { cookie: content.cookie })).res.status).toBe(404);
  });

  it("reads the role again on every request: a removed or demoted member loses access at once", async () => {
    const app = opsApp();
    const operator = await member(`ops-guard-del-${tag()}@vnx.si`, "operator");
    expect((await send(app, "/ops/fake", { cookie: operator.cookie })).res.status).toBe(200);
    await deleteOpsMemberStatement(testEnv.DB, { userId: operator.user.id }).run();
    expect((await send(app, "/ops/fake", { cookie: operator.cookie })).res.status).toBe(404);

    const demoted = await member(`ops-guard-dem-${tag()}@vnx.si`, "operator");
    expect((await send(app, "/ops/fake", { cookie: demoted.cookie, method: "POST" })).res.status).toBe(200);
    await testEnv.DB.prepare("UPDATE ops_members SET role = 'viewer' WHERE user_id = ?1").bind(demoted.user.id).run();
    expect((await send(app, "/ops/fake", { cookie: demoted.cookie, method: "POST" })).res.status).toBe(404);
    expect((await send(app, "/ops/fake", { cookie: demoted.cookie })).body).toBe("view:viewer");
  });

  it("suspension removes Ops at once and unsuspension restores it, root Owner and member alike", async () => {
    const operator = await member(`ops-guard-susp-${tag()}@vnx.si`, "operator");
    const root = await ensureUser(ROOT);
    for (const user of [operator.user, root]) {
      const stale = opsApp(sessionUser(user));
      expect((await send(stale, "/ops/fake")).res.status, user.email).toBe(200);
      await suspend(user.id);
      expect((await send(stale, "/ops/fake")).res.status, user.email).toBe(404);
      await unsuspend(user.id);
      expect((await send(stale, "/ops/fake")).res.status, user.email).toBe(200);
    }
  });

  it("ignores users.is_admin: a stored admin outside ADMIN_EMAILS has no Ops role", async () => {
    const legacy = await signIn(`ops-guard-legacy-${tag()}@vnx.si`, { admin: true });
    expect((await send(opsApp(), "/ops/fake", { cookie: legacy.cookie })).res.status).toBe(404);
  });
});

describe("no-store and noindex on every /ops response (AC3, spec §5)", () => {
  it("marks 200, 303, 404, 409 and 500 from guarded routes", async () => {
    const app = opsApp();
    const operator = await member(`ops-guard-hdr-${tag()}@vnx.si`, "operator");
    const cases: Array<[string, number, Opts]> = [
      ["/ops/fake", 200, { cookie: operator.cookie }],
      ["/ops/fake", 200, { cookie: operator.cookie, method: "POST" }],
      ["/ops/fake/redirect", 303, { cookie: operator.cookie }],
      ["/ops/fake/conflict", 409, { cookie: operator.cookie }],
      ["/ops/fake/boom", 500, { cookie: operator.cookie }],
      ["/ops/fake/team", 404, { cookie: operator.cookie }],
      ["/ops/fake", 404, {}],
    ];
    for (const [path, status, opts] of cases) {
      const { res } = await send(app, path, opts);
      const name = `${opts.method ?? "GET"} ${path}`;
      expect(res.status, name).toBe(status);
      expect(res.headers.get("cache-control"), name).toBe("no-store");
      expect(res.headers.get("x-robots-tag"), name).toBe("noindex, nofollow");
    }
  });

  it("marks the real app's /ops, /ops/ and any path below, signed in or not", async () => {
    const app = createApp();
    const root = await signIn(ROOT);
    for (const path of ["/ops", "/ops/", "/ops/marketplace/builders", "/ops/a/b/c"]) {
      for (const opts of [{}, { cookie: root.cookie }, { cookie: root.cookie, method: "POST" as const }]) {
        const { res } = await send(app, path, opts);
        const name = `${opts.method ?? "GET"} ${path} ${opts.cookie ? "signed in" : "anonymous"}`;
        // VNX-2503: GET /ops is the Overview page for a signed-in Owner; everything else here is still the sealed 404.
        const overview = path === "/ops" && opts.cookie !== undefined && !("method" in opts);
        expect(res.status, name).toBe(overview ? 200 : 404);
        expect(res.headers.get("cache-control"), name).toBe("no-store");
        expect(res.headers.get("x-robots-tag"), name).toBe("noindex, nofollow");
      }
    }
  });

  it("marks the refusals of the site-wide checks that run before any /ops route: Origin (403) and body size (413)", async () => {
    const app = createApp();
    const crossOrigin = (path: string) =>
      app.request(new Request(`https://vnx.si${path}`, { method: "POST", headers: { origin: "https://evil.example", "content-type": "application/x-www-form-urlencoded" }, body: "x=1" }), undefined, env);
    const ops = await crossOrigin("/ops/marketplace/builders");
    const elsewhere = await crossOrigin("/khong-ton-tai");
    // The Origin check is unchanged (spec §5) and answers every path alike, so it says nothing about /ops.
    expect(ops.status).toBe(elsewhere.status);
    expect(await ops.text()).toBe(await elsewhere.text());
    expect(ops.headers.get("cache-control")).toBe("no-store");
    expect(ops.headers.get("x-robots-tag")).toBe("noindex, nofollow");

    const big = await app.request(
      new Request("https://vnx.si/ops/x", { method: "POST", headers: { origin: "https://vnx.si", "content-type": "application/x-www-form-urlencoded" }, body: "x=" + "a".repeat(70 * 1024) }),
      undefined,
      env,
    );
    expect(big.status).toBe(413);
    expect(big.headers.get("cache-control")).toBe("no-store");
    expect(big.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("leaves paths that only start with the letters ops alone", async () => {
    const { res } = await send(createApp(), "/opsx");
    expect(res.headers.get("x-robots-tag")).toBeNull();
  });

  it("noStorePrivate also counts /ops as private", async () => {
    const app = new Hono<AppEnv>();
    app.use("*", async (c, next) => {
      c.set("user", null);
      await next();
    });
    app.use("*", noStorePrivate);
    app.get("*", (c) => c.text("x"));
    expect((await app.request("https://vnx.si/ops/x", {}, env)).headers.get("cache-control")).toBe("no-store");
    expect((await app.request("https://vnx.si/ops", {}, env)).headers.get("cache-control")).toBe("no-store");
    expect((await app.request("https://vnx.si/opsx", {}, env)).headers.get("cache-control")).toBeNull();
  });
});

describe("no login redirect, no 403 under /ops (AC4, spec §5)", () => {
  it("never sends anyone to /login and never answers 403", async () => {
    const plain = await signIn(`ops-guard-nologin-${tag()}@vnx.si`);
    const viewer = await member(`ops-guard-nologin-v-${tag()}@vnx.si`, "viewer");
    for (const app of [createApp(), opsApp()]) {
      for (const path of ["/ops", "/ops/fake", "/ops/fake/team", "/ops/marketplace/builders"]) {
        for (const opts of [{}, { cookie: plain.cookie }, { cookie: viewer.cookie }, { cookie: viewer.cookie, method: "POST" as const }, { method: "POST" as const }]) {
          const { res } = await send(app, path, opts);
          const name = `${opts.method ?? "GET"} ${path}`;
          expect(res.status, name).not.toBe(403);
          expect(res.status, name).not.toBe(401);
          expect(res.headers.get("location"), name).toBeNull();
        }
      }
    }
  });
});
