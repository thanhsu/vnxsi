import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.ts";
import { recordClick } from "../../src/db/clicks.ts";
import { utcDay } from "../../src/domain/stats.ts";
import { visitorHash } from "../../src/domain/visitor.ts";
import type { Bindings } from "../../src/env.ts";
import { resetNoSaltWarning } from "../../src/http/visitor.ts";
import { ulid } from "../../src/lib/ulid.ts";
import { makeLiveProduct, makeMerchant, makeOffer, makeProgram, signIn } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const UTM = "utm_source=vnx.si&utm_medium=referral";
const SALT = "go-product-test-salt-00000000000000";
const ENV = { ...testEnv, ANALYTICS_SALT: SALT, PRIVACY_NOTICE_GO_LIVE: "2026-01-01" } as Bindings;
const VID = "0123456789abcdef0123456789abcdef";
const VID2 = "fedcba9876543210fedcba9876543210";
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const EVIL = "evil.example.net";
const DEMO = "https://demo.example/app";
const SITE = "https://www.example.com/?ref=1";
const ZERO = { views: 0, demo_clicks: 0, outbound_clicks: 0, inquiries: 0 };

type Call = { method?: string; headers?: Record<string, string>; cf?: Record<string, unknown>; env?: Bindings };
async function call(path: string, o: Call = {}): Promise<Response> {
  const req = new Request(`https://vnx.si${path}`, { method: o.method ?? "GET", headers: o.headers });
  if (o.cf) Object.defineProperty(req, "cf", { value: o.cf });
  return await createApp().request(req, undefined, o.env ?? ENV);
}
/** A real browser carrying the visitor cookie (what Task 3 will set); `cookie` replaces the whole Cookie header. */
const visitor = (vid = VID, extra: Record<string, string> = {}) => ({ "user-agent": CHROME, cookie: `__Host-vnx_vid=${vid}`, ...extra });

let seq = 0;
async function live(fields: { demoUrl?: string | null; websiteUrl?: string | null } = { demoUrl: DEMO, websiteUrl: SITE }) {
  const email = `gp${++seq}@vnx.si`;
  const { builder, product } = await makeLiveProduct(email, `gp${seq}`, `gp${seq} product`, { fields });
  return { email, builder, product, slug: product.slug };
}
const clicks = async (productId: string) => (await testEnv.DB.prepare("SELECT * FROM outbound_clicks WHERE product_id = ?1 ORDER BY id").bind(productId).all<Record<string, unknown>>()).results;
const stat = async (productId: string) => (await testEnv.DB.prepare("SELECT views, demo_clicks, outbound_clicks, inquiries FROM product_daily_stats WHERE product_id = ?1").bind(productId).first<Record<string, number>>()) ?? ZERO;
const count = async (table: string) => (await testEnv.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())?.n ?? 0;

beforeEach(() => resetNoSaltWarning());
afterEach(() => vi.restoreAllMocks());

describe("route order (the /go/* catch-all stays last)", { timeout: 30_000 }, () => {
  it("a valid /go/p/<slug>/{demo,site} is a 302, not swallowed by the catch-all", async () => {
    const { slug } = await live();
    expect((await call(`/go/p/${slug}/demo`)).status).toBe(302);
    expect((await call(`/go/p/${slug}/site`)).status).toBe(302);
  });
  it.each(["/go/p", "/go/p/", "/go/p/some-product", "/go/p/some-product/other", "/go/p/some-product/demo/extra", "/go/p//demo"])("%s stays a 404 from the catch-all", async (path) => {
    const res = await call(path);
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("404 cases write nothing", { timeout: 30_000 }, () => {
  it("unknown, malformed and upper-case slugs", async () => {
    const { slug } = await live();
    const before = await count("outbound_clicks");
    for (const path of ["/go/p/does-not-exist/demo", "/go/p/-x-/demo", "/go/p/a/demo", `/go/p/${slug.toUpperCase()}/demo`, "/go/p/%00/demo", "/go/p/..%2f/demo"]) {
      const res = await call(path, { headers: visitor() });
      expect(res.status, path).toBe(404);
      expect(res.headers.get("location"), path).toBeNull();
    }
    expect(await count("outbound_clicks")).toBe(before);
  });
  it("a product that is not published, or whose builder is not approved", async () => {
    const { product, slug, builder } = await live();
    for (const status of ["draft", "in_review", "changes_requested", "unlisted", "suspended", "archived"]) {
      await testEnv.DB.prepare("UPDATE products SET status = ?2 WHERE id = ?1").bind(product.id, status).run();
      expect((await call(`/go/p/${slug}/demo`, { headers: visitor() })).status, status).toBe(404);
    }
    await testEnv.DB.prepare("UPDATE products SET status = 'published' WHERE id = ?1").bind(product.id).run();
    for (const status of ["pending", "rejected", "suspended"]) {
      await testEnv.DB.prepare("UPDATE builders SET status = ?2 WHERE user_id = ?1").bind(builder.userId, status).run();
      expect((await call(`/go/p/${slug}/demo`, { headers: visitor() })).status, status).toBe(404);
    }
    expect(await clicks(product.id)).toHaveLength(0);
  });
  it("a missing URL is a 404 for that kind only", async () => {
    const { product, slug } = await live({ demoUrl: null, websiteUrl: SITE });
    expect((await call(`/go/p/${slug}/demo`)).status).toBe(404);
    expect((await call(`/go/p/${slug}/site`)).status).toBe(302);
    expect(await clicks(product.id)).toHaveLength(1);
  });
  it.each(["http://demo.example/", "//evil.com", "https://127.0.0.1/", "https://u@evil.com/", "https://demo.example:8443/", "https://demo.example/a\\b", "https://demo.example/a\r\nSet-Cookie: x=y"])("a corrupt stored URL %j is a 404 with console.error and no click", async (bad) => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { product, slug } = await live();
    await testEnv.DB.prepare("UPDATE products SET demo_url = ?2 WHERE id = ?1").bind(product.id, bad).run();
    const res = await call(`/go/p/${slug}/demo`, { headers: visitor() });
    expect(res.status).toBe(404);
    expect(res.headers.get("location")).toBeNull();
    expect(spy.mock.calls.map((c) => String(c[0])).some((l) => l.includes("go.corrupt_data") && l.includes("product_url_invalid"))).toBe(true);
    expect(await clicks(product.id)).toHaveLength(0);
  });
});

describe("the redirect", { timeout: 30_000 }, () => {
  it("302 to the normalized URL plus UTM, with the headers", async () => {
    const { slug } = await live();
    const demo = await call(`/go/p/${slug}/demo?src=product_page`);
    expect(demo.status).toBe(302);
    expect(demo.headers.get("location")).toBe(`${DEMO}?${UTM}`);
    expect(demo.headers.get("cache-control")).toBe("no-store");
    expect(demo.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(demo.headers.get("referrer-policy")).toBe("origin");
    expect((await call(`/go/p/${slug}/site`)).headers.get("location")).toBe(`https://www.example.com/?ref=1&${UTM}`);
  });
  it("adds no UTM when the stored URL already has any utm_*", async () => {
    const { product, slug } = await live();
    await testEnv.DB.prepare("UPDATE products SET demo_url = 'https://demo.example/?UTM_Campaign=x' WHERE id = ?1").bind(product.id).run();
    expect((await call(`/go/p/${slug}/demo`)).headers.get("location")).toBe("https://demo.example/?UTM_Campaign=x");
  });
  it("Location comes from the database only: ?url=, ?src=<url>, ?to=//host change nothing", async () => {
    const { product, slug } = await live();
    const res = await call(`/go/p/${slug}/demo?url=https://${EVIL}/&src=https://${EVIL}/&to=//${EVIL}`);
    expect(res.headers.get("location")).toBe(`${DEMO}?${UTM}`);
    expect((await clicks(product.id))[0]?.src).toBe("unknown");
  });
  it("stores src from the enum, the locale of the Referer page, and no IP, e-mail or user id", async () => {
    const { product, slug } = await live();
    await call(`/go/p/${slug}/demo?src=product_page`, { headers: { "user-agent": CHROME, referer: `https://vnx.si/vi/p/${slug}` }, cf: { country: "VN" } });
    const [row] = await clicks(product.id);
    expect(row).toMatchObject({ link_kind: "demo", src: "product_page", locale: "vi", offer_id: null, country: "VN", referrer_host: "vnx.si", is_bot: 0, visitor_hash: null });
    expect(Object.keys(row!).sort()).toEqual(["country", "created_at", "id", "is_bot", "link_kind", "locale", "offer_id", "product_id", "referrer_host", "src", "visitor_hash"]);
  });
  it("HEAD redirects and records nothing; POST/PUT/DELETE are 405 with Allow: GET, HEAD; a foreign Origin is 403", async () => {
    const { product, slug } = await live();
    const head = await call(`/go/p/${slug}/demo`, { method: "HEAD", headers: visitor() });
    expect(head.status).toBe(302);
    expect(head.headers.get("location")).toBe(`${DEMO}?${UTM}`);
    for (const method of ["POST", "PUT", "DELETE"]) {
      const res = await call(`/go/p/${slug}/demo`, { method, headers: { origin: "https://vnx.si" } });
      expect(res.status, method).toBe(405);
      expect(res.headers.get("allow")).toBe("GET, HEAD");
    }
    expect((await call(`/go/p/${slug}/demo`, { method: "POST", headers: { origin: `https://${EVIL}` } })).status).toBe(403);
    expect(await clicks(product.id)).toHaveLength(0);
    expect(await stat(product.id)).toEqual(ZERO);
  });
  it("sets no cookie (M2: /go/p/ only reads it)", async () => {
    const { slug } = await live();
    expect((await call(`/go/p/${slug}/demo`, { headers: { "user-agent": CHROME } })).headers.get("set-cookie")).toBeNull();
  });
});

describe("counting truth table (spec 8.11, M3, L4)", { timeout: 30_000 }, () => {
  it("a normal visitor with the cookie: demo adds demo_clicks and outbound_clicks, site adds outbound_clicks; the row carries the day hash", async () => {
    const { product, slug } = await live();
    await call(`/go/p/${slug}/demo`, { headers: visitor() });
    expect(await stat(product.id)).toEqual({ ...ZERO, demo_clicks: 1, outbound_clicks: 1 });
    await call(`/go/p/${slug}/site`, { headers: visitor() });
    expect(await stat(product.id)).toEqual({ ...ZERO, demo_clicks: 1, outbound_clicks: 2 });
    const rows = await clicks(product.id);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.visitor_hash).toBe(await visitorHash(SALT, utcDay(new Date()), VID));
    expect(rows[0]?.visitor_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it.each([
    ["a bot user agent", { headers: { "user-agent": "curl/8.5.0", cookie: `__Host-vnx_vid=${VID}` } }],
    ["an empty user agent", { headers: { "user-agent": "", cookie: `__Host-vnx_vid=${VID}` } }],
    ["a Cloudflare verified bot", { headers: visitor(), cf: { botManagement: { verifiedBot: true } } }],
    ["Sec-GPC: 1", { headers: visitor(VID, { "sec-gpc": "1" }) }],
    ["no ANALYTICS_SALT", { headers: visitor(), env: { ...testEnv, ANALYTICS_SALT: undefined } as Bindings }],
    ["a blank ANALYTICS_SALT", { headers: visitor(), env: { ...testEnv, ANALYTICS_SALT: "   " } as Bindings }],
    ["no cookie", { headers: { "user-agent": CHROME } }],
    ["a malformed cookie", { headers: { "user-agent": CHROME, cookie: "__Host-vnx_vid=not-hex" } }],
  ] as [string, Call][])("%s: the click row is written with a null hash, product_daily_stats is untouched", async (_name, o) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { product, slug } = await live();
    const before = await count("product_daily_stats");
    expect((await call(`/go/p/${slug}/demo`, o)).status).toBe(302);
    const rows = await clicks(product.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.visitor_hash).toBeNull();
    expect(await stat(product.id)).toEqual(ZERO);
    expect(await count("product_daily_stats")).toBe(before);
    // M3: a missing or blank salt warns exactly once per isolate (the warning is reset in beforeEach).
    expect(warn.mock.calls.filter((c) => String(c[0]).includes("visitor.no_salt"))).toHaveLength(_name.includes("ANALYTICS_SALT") ? 1 : 0);
  });

  it("marks bot rows is_bot = 1", async () => {
    const { product, slug } = await live();
    await call(`/go/p/${slug}/demo`, { headers: { "user-agent": "Googlebot/2.1", cookie: `__Host-vnx_vid=${VID}` } });
    expect((await clicks(product.id))[0]?.is_bot).toBe(1);
  });

  it("the product's own builder is not counted (row written)", async () => {
    const { product, slug, email } = await live();
    const { cookie } = await signIn(email);
    expect((await call(`/go/p/${slug}/demo`, { headers: visitor(VID, { cookie: `${cookie}; __Host-vnx_vid=${VID}` }) })).status).toBe(302);
    expect(await clicks(product.id)).toHaveLength(1);
    expect(await stat(product.id)).toEqual(ZERO);
  });

  it("staff (admin listed in ADMIN_EMAILS) is not counted; a signed-in ordinary user is", async () => {
    const a = await live();
    const admin = await signIn("owner@vnx.si", { admin: true });
    await call(`/go/p/${a.slug}/demo`, { headers: visitor(VID, { cookie: `${admin.cookie}; __Host-vnx_vid=${VID}` }) });
    expect(await stat(a.product.id)).toEqual(ZERO);
    const user = await signIn("gp-plain@vnx.si");
    await call(`/go/p/${a.slug}/demo`, { headers: visitor(VID2, { cookie: `${user.cookie}; __Host-vnx_vid=${VID2}` }) });
    expect(await stat(a.product.id)).toEqual({ ...ZERO, demo_clicks: 1, outbound_clicks: 1 });
  });

  it("the same visitor, product and kind counts once per UTC day; another visitor, kind or product counts separately", async () => {
    const a = await live();
    const b = await live();
    for (let i = 0; i < 3; i++) await call(`/go/p/${a.slug}/demo`, { headers: visitor() });
    expect(await stat(a.product.id)).toEqual({ ...ZERO, demo_clicks: 1, outbound_clicks: 1 });
    expect(await clicks(a.product.id)).toHaveLength(3);
    await call(`/go/p/${a.slug}/demo`, { headers: visitor(VID2) });
    await call(`/go/p/${b.slug}/demo`, { headers: visitor() });
    expect((await stat(a.product.id)).demo_clicks).toBe(2);
    expect((await stat(b.product.id)).demo_clicks).toBe(1);
  });

  it("counts again on a new UTC day (a row from yesterday does not dedupe today)", async () => {
    const { product, slug } = await live();
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    await recordClick(testEnv.DB, { id: ulid(Date.parse(yesterday)), productId: product.id, offerId: null, linkKind: "demo", src: "unknown", locale: "en", visitorHash: await visitorHash(SALT, utcDay(new Date()), VID), country: null, referrerHost: null, isBot: false, createdAt: yesterday });
    await call(`/go/p/${slug}/demo`, { headers: visitor() });
    expect((await stat(product.id)).demo_clicks).toBe(1);
  });

  it("warns once per isolate when ANALYTICS_SALT is missing, and still redirects", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { slug } = await live();
    for (let i = 0; i < 3; i++) expect((await call(`/go/p/${slug}/demo`, { headers: visitor(), env: { ...testEnv, ANALYTICS_SALT: undefined } as Bindings })).status).toBe(302);
    expect(warn.mock.calls.filter((c) => String(c[0]).includes("visitor.no_salt"))).toHaveLength(1);
  });

  /** The real D1 except that `prepare` throws for any SQL containing `match`. */
  const breakDb = (match: string) =>
    new Proxy(testEnv.DB, {
      get(target, prop) {
        if (prop === "prepare") return (sql: string) => { if (sql.includes(match)) throw new Error(`${match} unavailable`); return target.prepare(sql); };
        const v = Reflect.get(target, prop) as unknown;
        return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(target) : v;
      },
    });
  const logged = (spy: { mock: { calls: unknown[][] } }, event: string) => spy.mock.calls.some((c) => String(c[0]).includes(event));

  it("a failing stats write never breaks the redirect or loses the click row", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { product, slug } = await live();
    expect((await call(`/go/p/${slug}/demo`, { headers: visitor(), env: { ...ENV, DB: breakDb("product_daily_stats") } as Bindings })).status).toBe(302);
    expect(await clicks(product.id)).toHaveLength(1);
    expect(logged(error, "go.stat_failed")).toBe(true);
  });

  it("a failing dedupe read: 302, one click row, stats untouched, go.dedupe_failed logged (L6)", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { product, slug } = await live();
    expect((await call(`/go/p/${slug}/demo`, { headers: visitor(), env: { ...ENV, DB: breakDb("SELECT 1 AS hit") } as Bindings })).status).toBe(302);
    expect(await clicks(product.id)).toHaveLength(1);
    expect(await stat(product.id)).toEqual(ZERO);
    expect(logged(error, "go.dedupe_failed")).toBe(true);
  });

  it("a throwing staff check never rejects the tracker (M2): 302, one row with the hash, stats untouched, go.count_failed logged", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { product, slug } = await live();
    const admin = await signIn("owner@vnx.si", { admin: true });
    const env = { ...ENV } as Bindings;
    Object.defineProperty(env, "ADMIN_EMAILS", { get() { throw new Error("staff lookup failed"); } });
    const res = await call(`/go/p/${slug}/demo`, { headers: visitor(VID, { cookie: `${admin.cookie}; __Host-vnx_vid=${VID}` }), env });
    expect(res.status).toBe(302);
    const rows = await clicks(product.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.visitor_hash).toBe(await visitorHash(SALT, utcDay(new Date()), VID));
    expect(await stat(product.id)).toEqual(ZERO);
    expect(logged(error, "go.count_failed")).toBe(true);
  });

  it("two simultaneous first clicks of one visitor count once (S12: in-flight set), three rows are not needed: two rows, one count", async () => {
    const { product, slug } = await live();
    const [a, b] = await Promise.all([call(`/go/p/${slug}/demo`, { headers: visitor() }), call(`/go/p/${slug}/demo`, { headers: visitor() })]);
    expect([a.status, b.status]).toEqual([302, 302]);
    expect(await clicks(product.id)).toHaveLength(2);
    expect(await stat(product.id)).toEqual({ ...ZERO, demo_clicks: 1, outbound_clicks: 1 });
  });
});
describe("offer clicks never touch product_daily_stats (L4)", { timeout: 30_000 }, () => {
  it("/go/o/:id and /go/:merchant, even with a valid visitor cookie, add no product_daily_stats row and keep a null hash", async () => {
    const merchant = await makeMerchant();
    const offer = await makeOffer(merchant, await makeProgram(merchant));
    const before = await count("product_daily_stats");
    expect((await call(`/go/o/${offer.id}`, { headers: visitor() })).status).toBe(302);
    await call(`/go/${merchant.slug}`, { headers: visitor() });
    expect(await count("product_daily_stats")).toBe(before);
    const rows = (await testEnv.DB.prepare("SELECT link_kind, visitor_hash, product_id FROM outbound_clicks WHERE offer_id = ?1").bind(offer.id).all<Record<string, unknown>>()).results;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.link_kind === "offer" && r.visitor_hash === null && r.product_id === null)).toBe(true);
  });
});
