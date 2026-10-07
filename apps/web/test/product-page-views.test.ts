import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.ts";
import { setBuilderStatus } from "../src/db/builders.ts";
import { visitorCookieMaxAge, visitorHash } from "../src/domain/visitor.ts";
import type { Bindings } from "../src/env.ts";
import { resetNoSaltWarning } from "../src/http/visitor.ts";
import { ensureUser, makeBuilder, makeDraft, makeLiveProduct, signIn } from "./fixtures.ts";
import { setCookieValue, testEnv } from "./helpers.ts";

const SALT = "product-views-test-salt-0000000000";
// The counting gate (Owner 2026-10-06): a valid go-live in the past. Every counting test needs it.
const ENV = { ...testEnv, ANALYTICS_SALT: SALT, PRIVACY_NOTICE_GO_LIVE: "2026-10-01" } as Bindings;
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const VID = "0123456789abcdef0123456789abcdef";
const COOKIE = "__Host-vnx_vid";

type Call = { method?: string; headers?: Record<string, string>; cf?: Record<string, unknown>; env?: Bindings };
async function call(path: string, o: Call = {}): Promise<Response> {
  const req = new Request(`https://vnx.si${path}`, { method: o.method ?? "GET", headers: o.headers });
  if (o.cf) Object.defineProperty(req, "cf", { value: o.cf });
  return await createApp().request(req, undefined, o.env ?? ENV);
}
const browser = (extra: Record<string, string> = {}) => ({ "user-agent": CHROME, ...extra });
const withVid = (vid = VID, extra: Record<string, string> = {}) => browser({ cookie: `${COOKIE}=${vid}`, ...extra });
const vidLine = (res: Response) => res.headers.getSetCookie().find((l) => l.startsWith(`${COOKIE}=`));
const hasVid = (res: Response) => vidLine(res) !== undefined;

let seq = 0;
/** The demo URL lets the /go/p/ test redirect (as go-product.test.ts does). */
async function live() {
  const n = ++seq;
  const email = `pv${n}@vnx.si`;
  const { builder, product } = await makeLiveProduct(email, `pv${n}`, `pv${n} product`, { fields: { demoUrl: "https://demo.example.com/" } });
  return { email, builder, product, slug: product.slug };
}
/** A signed-in Ops member (default Viewer, the lowest role) who is NOT users.is_admin. */
async function opsMember(email: string, role = "viewer") {
  const owner = await ensureUser("owner@vnx.si");
  const { user, cookie } = await signIn(email);
  const now = new Date().toISOString();
  await testEnv.DB.prepare("INSERT INTO ops_members (user_id, role, granted_by, granted_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)").bind(user.id, role, owner.id, now).run();
  return { user, cookie };
}
const views = async (productId: string) =>
  (await testEnv.DB.prepare("SELECT COALESCE(SUM(views), 0) AS n FROM product_daily_stats WHERE product_id = ?1").bind(productId).first<{ n: number }>())?.n ?? 0;
const viewsOn = async (productId: string, day: string) =>
  (await testEnv.DB.prepare("SELECT views FROM product_daily_stats WHERE product_id = ?1 AND day = ?2").bind(productId, day).first<{ views: number }>())?.views ?? 0;
const dedupeRows = async (productId: string) => (await testEnv.DB.prepare("SELECT day, visitor_hash, product_id FROM product_view_dedupe WHERE product_id = ?1 ORDER BY day").bind(productId).all<Record<string, string>>()).results;

beforeEach(() => resetNoSaltWarning());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("first view sets the cookie and counts (Review Focus 1, 2)", { timeout: 30_000 }, () => {
  it("200, views = 1, one dedupe row with the day hash, and a __Host- cookie that ends at 00:00 UTC", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-06T10:30:00Z"));
    const { product, slug } = await live();
    const res = await call(`/p/${slug}`, { headers: browser() });
    expect(res.status).toBe(200);
    const line = vidLine(res) ?? "";
    const id = setCookieValue(res, COOKIE) ?? "";
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(line).toContain("; Max-Age=48600"); // 13.5 h to 00:00 UTC
    expect(visitorCookieMaxAge(new Date("2026-10-06T10:30:00Z"))).toBe(48600);
    expect(line).toMatch(/; Path=\/(;|$)/);
    expect(line).toMatch(/; HttpOnly(;|$)/);
    expect(line).toMatch(/; Secure(;|$)/);
    expect(line).toMatch(/; SameSite=Lax(;|$)/);
    expect(line).not.toMatch(/Domain=/i);
    expect(res.headers.get("cache-control")).toBe("private");
    expect(await views(product.id)).toBe(1);
    expect(await dedupeRows(product.id)).toEqual([{ day: "2026-10-06", visitor_hash: (await visitorHash(SALT, "2026-10-06", id))!, product_id: product.id }]);
  });

  it("a second view with the cookie the same day: still 1, no new Set-Cookie", async () => {
    const { product, slug } = await live();
    const first = await call(`/p/${slug}`, { headers: browser() });
    const id = setCookieValue(first, COOKIE) ?? "";
    const second = await call(`/p/${slug}`, { headers: withVid(id) });
    expect(second.status).toBe(200);
    expect(hasVid(second)).toBe(false);
    expect(await views(product.id)).toBe(1);
    expect(await dedupeRows(product.id)).toHaveLength(1);
  });

  it("counts again after 00:00 UTC for the same cookie, with a different hash", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-06T23:59:58Z"));
    const { product, slug } = await live();
    const first = await call(`/p/${slug}`, { headers: browser() });
    const id = setCookieValue(first, COOKIE) ?? "";
    expect(vidLine(first)).toContain("; Max-Age=2");
    vi.setSystemTime(new Date("2026-10-06T23:59:59.500Z"));
    await call(`/p/${slug}`, { headers: withVid(id) });
    expect(await viewsOn(product.id, "2026-10-06")).toBe(1);
    vi.setSystemTime(new Date("2026-10-07T00:00:00Z"));
    const next = await call(`/p/${slug}`, { headers: withVid(id) });
    expect(hasVid(next)).toBe(false);
    expect(await viewsOn(product.id, "2026-10-06")).toBe(1);
    expect(await viewsOn(product.id, "2026-10-07")).toBe(1);
    const rows = await dedupeRows(product.id);
    expect(rows.map((r) => r.day)).toEqual(["2026-10-06", "2026-10-07"]);
    expect(rows[0]?.visitor_hash).not.toBe(rows[1]?.visitor_hash);
  });

  it("two products with the same cookie count once each", async () => {
    const a = await live();
    const b = await live();
    const first = await call(`/p/${a.slug}`, { headers: browser() });
    const id = setCookieValue(first, COOKIE) ?? "";
    await call(`/p/${b.slug}`, { headers: withVid(id) });
    await call(`/p/${a.slug}`, { headers: withVid(id) });
    expect(await views(a.product.id)).toBe(1);
    expect(await views(b.product.id)).toBe(1);
  });

  it("another visitor counts separately; a locale prefix shares the same daily count", async () => {
    const { product, slug } = await live();
    await call(`/p/${slug}`, { headers: withVid(VID) });
    await call(`/vi/p/${slug}`, { headers: withVid(VID) });
    expect(await views(product.id)).toBe(1);
    await call(`/zh-hans/p/${slug}`, { headers: withVid("fedcba9876543210fedcba9876543210") });
    expect(await views(product.id)).toBe(2);
  });

  it("a malformed cookie value is ignored: a fresh cookie is set and one view counted", async () => {
    const { product, slug } = await live();
    for (const bad of ["x", "0123456789ABCDEF0123456789ABCDEF", "0123456789abcdef0123456789abcde"]) {
      const res = await call(`/p/${slug}`, { headers: withVid(bad) });
      expect(setCookieValue(res, COOKIE)).toMatch(/^[0-9a-f]{32}$/);
    }
    expect(await views(product.id)).toBe(3);
  });
});

describe("the counting gate: PRIVACY_NOTICE_GO_LIVE (Owner 2026-10-06)", { timeout: 30_000 }, () => {
  it.each([undefined, "", "2026-02-30", "20-10-2026"])("go-live %j: page 200, no cookie, no rows, no warning, even with a salt", async (goLive) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { product, slug } = await live();
    const res = await call(`/p/${slug}`, { headers: browser(), env: { ...ENV, PRIVACY_NOTICE_GO_LIVE: goLive } as Bindings });
    expect(res.status).toBe(200);
    expect(hasVid(res)).toBe(false);
    expect(await views(product.id)).toBe(0);
    expect(await dedupeRows(product.id)).toHaveLength(0);
    expect(warn).not.toHaveBeenCalled();
  });

  it("nothing counts before go-live 00:00Z, and counting starts at that instant", async () => {
    const env = { ...ENV, PRIVACY_NOTICE_GO_LIVE: "2026-10-20" } as Bindings;
    const { product, slug } = await live();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-19T23:59:59.999Z"));
    const before = await call(`/p/${slug}`, { headers: browser(), env });
    expect([before.status, hasVid(before)]).toEqual([200, false]);
    expect(await views(product.id)).toBe(0);
    vi.setSystemTime(new Date("2026-10-20T00:00:00.000Z"));
    const at = await call(`/p/${slug}`, { headers: browser(), env });
    expect([at.status, hasVid(at)]).toEqual([200, true]);
    expect(await viewsOn(product.id, "2026-10-20")).toBe(1);
  });

  it("a /go/p/ click with a valid cookie and a salt, before go-live: visitor_hash null and no stats (N1)", async () => {
    const env = { ...ENV, PRIVACY_NOTICE_GO_LIVE: "2026-10-20" } as Bindings;
    const { product, slug } = await live();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-19T23:59:59.999Z"));
    const res = await call(`/go/p/${slug}/demo`, { headers: withVid(), env });
    expect(res.status).toBe(302);
    const rows = (await testEnv.DB.prepare("SELECT visitor_hash FROM outbound_clicks WHERE product_id = ?1").bind(product.id).all<{ visitor_hash: string | null }>()).results;
    expect(rows.map((r) => r.visitor_hash)).toEqual([null]);
    expect((await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM product_daily_stats WHERE product_id = ?1").bind(product.id).first<{ n: number }>())?.n).toBe(0);
  });
});

describe("who is never counted: no row, no dedupe, no cookie", { timeout: 30_000 }, () => {
  const cases: [string, Call][] = [
    ["curl user agent", { headers: { "user-agent": "curl/8.4.0" } }],
    ["Googlebot", { headers: { "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" } }],
    ["empty user agent", { headers: { "user-agent": "" } }],
    ["Cloudflare verified bot", { headers: browser(), cf: { botManagement: { verifiedBot: true } } }],
    ["Sec-GPC: 1", { headers: browser({ "sec-gpc": "1" }) }],
    ["Sec-GPC: 1 with an existing valid cookie", { headers: withVid(VID, { "sec-gpc": "1" }) }],
  ];
  it.each(cases)("%s", async (_name, o) => {
    const { product, slug } = await live();
    const res = await call(`/p/${slug}`, o);
    expect(res.status).toBe(200);
    expect(hasVid(res)).toBe(false);
    expect(res.headers.get("cache-control") ?? "").not.toContain("private");
    expect(await views(product.id)).toBe(0);
    expect(await dedupeRows(product.id)).toHaveLength(0);
  });

  it("the product's own builder, and staff (admin in ADMIN_EMAILS), are not counted; an ordinary signed-in user is", async () => {
    const { product, slug, email } = await live();
    const own = await signIn(email);
    const ownRes = await call(`/p/${slug}`, { headers: browser({ cookie: own.cookie }) });
    expect([ownRes.status, hasVid(ownRes)]).toEqual([200, false]);
    const admin = await signIn("owner@vnx.si", { admin: true });
    const staffRes = await call(`/p/${slug}`, { headers: browser({ cookie: `${admin.cookie}; ${COOKIE}=${VID}` }) });
    expect([staffRes.status, hasVid(staffRes)]).toEqual([200, false]);
    expect(await views(product.id)).toBe(0);
    const plain = await signIn("pv-plain@vnx.si");
    const plainRes = await call(`/p/${slug}`, { headers: browser({ cookie: plain.cookie }) });
    expect(hasVid(plainRes)).toBe(true);
    expect(await views(product.id)).toBe(1);
  });

  it("HEAD neither counts nor sets a cookie", async () => {
    const { product, slug } = await live();
    const res = await call(`/p/${slug}`, { method: "HEAD", headers: browser() });
    expect(res.status).toBe(200);
    expect(hasVid(res)).toBe(false);
    expect(await views(product.id)).toBe(0);
  });
});

describe("no salt: nothing is counted and no cookie is set (Global Constraints, Review Focus 2)", { timeout: 30_000 }, () => {
  it.each([undefined, "", "   "])("ANALYTICS_SALT %j: page 200, no cookie, no rows, one warning per isolate", async (salt) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { product, slug } = await live();
    const env = { ...ENV, ANALYTICS_SALT: salt } as Bindings;
    for (let i = 0; i < 2; i++) {
      const res = await call(`/p/${slug}`, { headers: browser(), env });
      expect(res.status).toBe(200);
      expect(hasVid(res)).toBe(false);
    }
    expect(await views(product.id)).toBe(0);
    expect(await dedupeRows(product.id)).toHaveLength(0);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.parse(warn.mock.calls[0]?.[0] as string).event).toBe("visitor.no_salt");
  });
});

describe("the cookie exists only on GET /p/:slug 200", { timeout: 30_000 }, () => {
  it("404 (unknown, malformed, draft, builder not approved) and the 301 for an upper-case slug set nothing", async () => {
    const { slug, builder, product } = await live();
    const draft = await makeDraft("pv-draft@vnx.si", "pv-draft", "pv draft");
    for (const path of ["/p/does-not-exist", "/p/-x-", `/p/${draft.product.slug}`]) {
      const res = await call(path, { headers: browser() });
      expect([path, res.status]).toEqual([path, 404]);
      expect(hasVid(res)).toBe(false);
    }
    const upper = await call(`/p/${slug.toUpperCase()}`, { headers: browser() });
    expect(upper.status).toBe(301);
    expect(hasVid(upper)).toBe(false);
    await setBuilderStatus(testEnv.DB, { userId: builder.userId, from: "approved", to: "suspended", reviewNote: null, now: new Date().toISOString() });
    const suspended = await call(`/p/${slug}`, { headers: browser() });
    expect([suspended.status, hasVid(suspended)]).toEqual([404, false]);
    expect(await dedupeRows(product.id)).toHaveLength(0);
    expect(await dedupeRows(draft.product.id)).toHaveLength(0);
  });

  it("an Ops Viewer (not is_admin) is staff: /p/ counts nothing and sets no cookie, and neither does their /go/p/ click", async () => {
    const { product, slug } = await live();
    const viewer = await opsMember("pv-ops-viewer@vnx.si");
    expect(viewer.user.is_admin).toBeFalsy();
    const res = await call(`/p/${slug}`, { headers: browser({ cookie: `${viewer.cookie}; ${COOKIE}=${VID}` }) });
    expect([res.status, hasVid(res)]).toEqual([200, false]);
    expect(await views(product.id)).toBe(0);
    expect(await dedupeRows(product.id)).toHaveLength(0);
    const go = await call(`/go/p/${slug}/demo`, { headers: browser({ cookie: `${viewer.cookie}; ${COOKIE}=${VID}` }) });
    expect([go.status, hasVid(go)]).toEqual([302, false]);
    expect(await views(product.id)).toBe(0);
    expect(await dedupeRows(product.id)).toHaveLength(0);
  });

  it("/go/p/, /admin, /hub, /me and /ops never set it, even for a counted visitor", async () => {
    const { slug } = await live();
    const ops = await opsMember("pv-ops-nav@vnx.si");
    await makeBuilder("pv-hub@vnx.si", "pv-hub", "approved");
    const user = await signIn("pv-hub@vnx.si");
    const admin = await signIn("owner@vnx.si", { admin: true });
    const go = await call(`/go/p/${slug}/demo`, { headers: browser() });
    expect([go.status, hasVid(go)]).toEqual([302, false]);
    for (const [path, cookie] of [["/hub", user.cookie], ["/me", user.cookie], ["/admin", admin.cookie], ["/ops", ops.cookie]] as const) {
      const res = await call(path, { headers: browser({ cookie }) });
      expect([path, hasVid(res)]).toEqual([path, false]);
    }
  });
});

describe("privacy and failure", { timeout: 30_000 }, () => {
  it("a signed-in visitor leaves no IP, e-mail or user id in this product's dedupe or stats rows", async () => {
    const { product, slug } = await live();
    const user = await signIn("pv-privacy@vnx.si");
    await call(`/p/${slug}`, { headers: browser({ cookie: user.cookie, "cf-connecting-ip": "203.0.113.9", "x-forwarded-for": "203.0.113.9" }) });
    expect(await views(product.id)).toBe(1);
    const dump = JSON.stringify([
      ...(await testEnv.DB.prepare("SELECT * FROM product_view_dedupe WHERE product_id = ?1").bind(product.id).all()).results,
      ...(await testEnv.DB.prepare("SELECT * FROM product_daily_stats WHERE product_id = ?1").bind(product.id).all()).results,
    ]);
    for (const secret of ["203.0.113.9", "pv-privacy@vnx.si", user.user.id]) expect(dump).not.toContain(secret);
  });

  it("a failing write is logged and never breaks the page (the cookie is still set)", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { slug } = await live();
    const db = new Proxy(testEnv.DB, {
      get(target, prop) {
        if (prop === "prepare") return (sql: string) => (sql.includes("product_view_dedupe") ? (() => { throw new Error("boom"); })() : target.prepare(sql));
        const value = Reflect.get(target, prop) as unknown;
        return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(target) : value;
      },
    });
    const res = await call(`/p/${slug}`, { headers: browser(), env: { ...ENV, DB: db } as Bindings });
    expect(res.status).toBe(200);
    expect(hasVid(res)).toBe(true);
    expect(error.mock.calls.map((c) => JSON.parse(c[0] as string).event)).toContain("product.view_failed");
  });

  it("a throwing staff lookup is logged and the page still renders without a cookie", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { slug } = await live();
    const admin = await signIn("pv-staff-throws@vnx.si", { admin: true });
    const env = { ...ENV };
    Object.defineProperty(env, "ADMIN_EMAILS", { get() { throw new Error("staff lookup failed"); } });
    const res = await call(`/p/${slug}`, { headers: browser({ cookie: admin.cookie }), env: env as Bindings });
    expect(res.status).toBe(200);
    expect(hasVid(res)).toBe(false);
    expect(error.mock.calls.map((c) => JSON.parse(c[0] as string).event)).toContain("product.view_decide_failed");
  });
});
