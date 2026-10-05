import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.ts";
import { resetFlagCache, setFlag } from "../../src/db/flags.ts";
import { setDefaultOffer } from "../../src/db/merchants.ts";
import type { Bindings } from "../../src/env.ts";
import { ulid } from "../../src/lib/ulid.ts";
import { ensureUser, makeMerchant, makeOffer, makeProgram, signIn } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const UTM = "utm_source=vnx.si&utm_medium=referral";
const EVIL = "evil.example.net";
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

type ClickRow = { id: string; product_id: string | null; offer_id: string | null; link_kind: string; src: string; locale: string; visitor_hash: string | null; country: string | null; referrer_host: string | null; is_bot: number; created_at: string };
type Seeded = Awaited<ReturnType<typeof seed>>;
type Call = { method?: string; headers?: Record<string, string>; cf?: Record<string, unknown>; env?: Bindings; ctx?: ExecutionContext };

/** One request through the real app. `cf` is set on the Request itself, as Cloudflare does. */
async function call(path: string, o: Call = {}): Promise<Response> {
  const req = new Request(`https://vnx.si${path}`, { method: o.method ?? "GET", headers: o.headers });
  if (o.cf) Object.defineProperty(req, "cf", { value: o.cf });
  return await createApp().request(req, undefined, o.env ?? testEnv, o.ctx);
}

const run = (sql: string, ...binds: unknown[]) => testEnv.DB.prepare(sql).bind(...binds).run();
const clicksOf = async (offerId: string) => (await testEnv.DB.prepare("SELECT * FROM outbound_clicks WHERE offer_id = ?1 ORDER BY id").bind(offerId).all<ClickRow>()).results;
const totalClicks = async () => (await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM outbound_clicks").first<{ n: number }>())?.n ?? 0;

async function setFlags(on: { affiliate?: boolean; partner_referral?: boolean }) {
  const admin = await ensureUser("go-admin@vnx.si");
  for (const key of ["affiliate", "partner_referral"] as const) await setFlag(testEnv.DB, { key, enabled: on[key] ?? false, actorUserId: admin.id, now: new Date().toISOString() });
  resetFlagCache();
}

/** A merchant on example.com with (by default) an active program, its offer, and that offer as the merchant's default. */
async function seed(o: { merchant?: Parameters<typeof makeMerchant>[0]; program?: Parameters<typeof makeProgram>[1] | null; offer?: Parameters<typeof makeOffer>[2] } = {}) {
  const merchant = await makeMerchant(o.merchant);
  const program = o.program === null ? null : await makeProgram(merchant, o.program);
  const offer = await makeOffer(merchant, program, o.offer);
  const admin = await ensureUser("go-admin@vnx.si");
  await setDefaultOffer(testEnv.DB, { merchantId: merchant.id, offerId: offer.id, actorUserId: admin.id, now: new Date().toISOString() });
  return { merchant, program, offer };
}

const tracked = (clickId: string) => `https://example.com/r?c=${clickId}`;
function expectRedirectHeaders(res: Response) {
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  expect(res.headers.get("referrer-policy")).toBe("origin");
}
const goLogs = (spy: { mock: { calls: unknown[][] } }) => spy.mock.calls.map((c) => JSON.parse(String(c[0])) as Record<string, unknown>).filter((l) => String(l.event).startsWith("go."));

beforeEach(async () => {
  await setFlags({ affiliate: true });
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("/go/o/:offerId and /go/:merchantSlug: the redirect truth table over HTTP", () => {
  it("tracked: flag on, everything active → 302 to the filled template; the click row id is the click_id", async () => {
    const { offer, merchant } = await seed();
    const res = await call(`/go/o/${offer.id}?src=tools`);
    expect(res.status).toBe(302);
    expectRedirectHeaders(res);
    const rows = await clicksOf(offer.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toMatch(ULID_RE);
    expect(res.headers.get("location")).toBe(tracked(rows[0]?.id ?? ""));
    // The same offer through the merchant's slug.
    const bySlug = await call(`/go/${merchant.slug}`);
    expect(bySlug.status).toBe(302);
    expectRedirectHeaders(bySlug);
    expect(bySlug.headers.get("location")).toBe(tracked((await clicksOf(offer.id)).find((r) => r.id !== rows[0]?.id)?.id ?? ""));
  });

  it("fills {src} and {locale} from the enum and the Referer, never from raw input", async () => {
    const { offer } = await seed({ offer: { trackingTemplate: "https://example.com/r?c={click_id}&s={src}&l={locale}" } });
    const a = await call(`/go/o/${offer.id}?src=tools`, { headers: { referer: "https://vnx.si/vi/tools/x" } });
    const b = await call(`/go/o/${offer.id}?src=${encodeURIComponent(`https://${EVIL}`)}`, { headers: { referer: `https://${EVIL}/vi/x` } });
    const ids = (await clicksOf(offer.id)).map((r) => r.id);
    expect(ids).toHaveLength(2);
    expect([a.headers.get("location"), b.headers.get("location")].map((l) => l?.replace(/c=[0-9A-Z]{26}/, "c=ID")).sort()).toEqual(["https://example.com/r?c=ID&s=tools&l=vi", "https://example.com/r?c=ID&s=unknown&l=en"]);
  });

  const FALLBACKS: [string, () => Promise<Seeded>][] = [
    ["merchant_paused", () => seed({ merchant: { status: "paused" } })],
    ["offer_paused", () => seed({ offer: { status: "paused" } })],
    ["offer_not_started", () => seed({ offer: { startsAt: "2999-01-01T00:00:00.000Z" } })],
    ["offer_ended", () => seed({ offer: { endsAt: "2000-01-01T00:00:00.000Z" } })],
    ["program_not_active (draft)", () => seed({ program: { status: "draft" } })],
    ["program_not_active (paused)", () => seed({ program: { status: "paused" } })],
    [
      "flag_off",
      async () => {
        const s = await seed();
        await setFlags({});
        return s;
      },
    ],
  ];

  it.each(FALLBACKS)("fallback (%s): 302 to the merchant website with utm, no click id, one click row", async (_reason, build) => {
    const { offer } = await build();
    const res = await call(`/go/o/${offer.id}`);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(`https://example.com/?${UTM}`);
    expectRedirectHeaders(res);
    const rows = await clicksOf(offer.id);
    expect(rows).toHaveLength(1);
    expect(res.headers.get("location")).not.toContain(rows[0]?.id ?? "?");
  });

  const SILENT: [string, () => Promise<string>][] = [
    ["offer unknown", async () => ulid()],
    [
      "offer archived",
      async () => {
        const s = await seed();
        await run("UPDATE offers SET status = 'archived' WHERE id = ?1", s.offer.id);
        return s.offer.id;
      },
    ],
    [
      "merchant archived",
      async () => {
        const s = await seed();
        await run("UPDATE merchants SET status = 'archived' WHERE id = ?1", s.merchant.id);
        return s.offer.id;
      },
    ],
  ];

  it.each(SILENT)("not found (%s): 404 in the default locale, no click, no error log", async (_what, build) => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const offerId = await build();
    const res = await call(`/go/o/${offerId}`);
    expect(res.status).toBe(404);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(await clicksOf(offerId)).toHaveLength(0);
    expect(goLogs(error)).toEqual([]);
  });

  const CORRUPT: [string, () => Promise<Seeded>][] = [
    [
      "invalid_url",
      async () => {
        const s = await seed();
        await run("UPDATE offers SET tracking_template = ?1 WHERE id = ?2", `https://${EVIL}/r?c={click_id}`, s.offer.id);
        return s;
      },
    ],
    [
      "window_invalid",
      async () => {
        const s = await seed();
        await run("UPDATE offers SET starts_at = 'not-a-date' WHERE id = ?1", s.offer.id);
        return s;
      },
    ],
    [
      "program_merchant",
      async () => {
        const s = await seed();
        const foreign = await makeProgram(await makeMerchant());
        await run("UPDATE offers SET program_id = ?1 WHERE id = ?2", foreign.id, s.offer.id);
        return s;
      },
    ],
    [
      "website_invalid",
      async () => {
        const s = await seed();
        await setFlags({});
        await run("UPDATE merchants SET website_url = ?1 WHERE id = ?2", `https://${EVIL}/`, s.merchant.id);
        return s;
      },
    ],
  ];

  it.each(CORRUPT)("corrupt data (%s): 404, no click, one error log without personal data", async (reason, build) => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const s = await build();
    const res = await call(`/go/o/${s.offer.id}`, { headers: { "cf-connecting-ip": "203.0.113.9", "user-agent": CHROME, referer: "https://news.example.org/secret?q=1" } });
    expect(res.status).toBe(404);
    expect(await clicksOf(s.offer.id)).toHaveLength(0);
    expect(goLogs(error)).toEqual([{ event: "go.corrupt_data", reason, offerId: s.offer.id, merchantId: s.merchant.id, requestId: expect.any(String) }]);
    const line = JSON.stringify(goLogs(error)[0]);
    for (const secret of [EVIL, "203.0.113.9", CHROME, "news.example.org"]) expect(line).not.toContain(secret);
  });

  it("an offer without a program needs no flag, redirects to its destination with utm, and records the click", async () => {
    await setFlags({});
    const { offer } = await seed({ program: null, offer: { destinationUrl: "https://example.com/pricing" } });
    const res = await call(`/go/o/${offer.id}`);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(`https://example.com/pricing?${UTM}`);
    expect(await clicksOf(offer.id)).toHaveLength(1);
    const kept = await seed({ program: null, offer: { destinationUrl: "https://example.com/pricing?utm_campaign=x" } });
    expect((await call(`/go/o/${kept.offer.id}`)).headers.get("location")).toBe("https://example.com/pricing?utm_campaign=x");
  });
});

describe("/go/:merchantSlug: which merchants answer", () => {
  it("a paused merchant, a merchant without a default offer, an unknown slug, an archived default offer: 404 and no click", async () => {
    const paused = await seed({ merchant: { status: "paused" } });
    const bare = await makeMerchant();
    const archivedOffer = await seed();
    await run("UPDATE offers SET status = 'archived' WHERE id = ?1", archivedOffer.offer.id);
    for (const slug of [paused.merchant.slug, bare.slug, "no-such-merchant", archivedOffer.merchant.slug]) {
      const res = await call(`/go/${slug}`);
      expect(res.status, slug).toBe(404);
      expect(res.headers.get("location"), slug).toBeNull();
    }
    expect(await clicksOf(paused.offer.id)).toHaveLength(0);
    expect(await clicksOf(archivedOffer.offer.id)).toHaveLength(0);
  });
});

describe("open redirect and URL tricks (Review Focus 1 and 2)", () => {
  it.each([
    `/go/https://${EVIL}`,
    `/go/%2F%2F${EVIL}`,
    `/go/%5C${EVIL}`,
    `/go//${EVIL}`,
    `/go/x%0d%0aLocation:%20https://${EVIL}`,
    `/go/..%2F..%2Fevil`,
    `/go/o/%2F%2F${EVIL}`,
    `/go/o/https://${EVIL}`,
  ])("%s is a 404 with no Location", async (path) => {
    const res = await call(path);
    expect(res.status).toBe(404);
    expect(res.headers.get("location")).toBeNull();
  });

  it("query parameters other than src are ignored; a hostile src becomes unknown; no header is injected", async () => {
    const { merchant, offer } = await seed();
    const query = `src=${encodeURIComponent(`https://${EVIL}`)}&url=https://${EVIL}&next=//${EVIL}&redirect=%5C%5C${EVIL}&to=${encodeURIComponent(`tools\r\nX-Injected: 1`)}`;
    const res = await call(`/go/${merchant.slug}?${query}`);
    const [row] = await clicksOf(offer.id);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(tracked(row?.id ?? ""));
    expect(res.headers.get("x-injected")).toBeNull();
    expect(row?.src).toBe("unknown");
  });

  const BAD_TEMPLATES = [
    `https://${EVIL}/r?c={click_id}`,
    `https://example.com@${EVIL}/r?c={click_id}`,
    `https://example.com.${EVIL}/{click_id}`,
    "https://evilexample.com/{click_id}",
    "http://example.com/r?c={click_id}",
    "https://127.0.0.1/{click_id}",
    "https://2130706433/{click_id}",
    "https://[::1]/{click_id}",
    "https://{src}/x",
    "https://example.com:8443/{click_id}",
    "https://example.com/{click_id}{x}",
  ];
  it.each(BAD_TEMPLATES)("a stored template %s is never followed: 404 on both routes, no click", async (template) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { offer, merchant } = await seed();
    await run("UPDATE offers SET tracking_template = ?1 WHERE id = ?2", template, offer.id);
    for (const path of [`/go/o/${offer.id}`, `/go/${merchant.slug}`]) {
      const res = await call(path);
      expect(res.status, path).toBe(404);
      expect(res.headers.get("location"), path).toBeNull();
    }
    expect(await clicksOf(offer.id)).toHaveLength(0);
  });

  const BAD_URLS = ["http://example.com/", `https://${EVIL}/`, "https://user:pw@example.com/", "https://127.0.0.1/", "javascript:alert(1)", `//${EVIL}`, `https:${EVIL}`, `https://example.com\\@${EVIL}/`, "https://example.com/\r\n"];
  it.each(BAD_URLS)("a stored destination_url %j on an offer without a program is never followed", async (destinationUrl) => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { offer } = await seed({ program: null, offer: { destinationUrl } });
    const res = await call(`/go/o/${offer.id}`);
    expect(res.status).toBe(404);
    expect(res.headers.get("location")).toBeNull();
    expect(goLogs(error).map((l) => l.reason)).toEqual(["invalid_url"]);
    expect(await clicksOf(offer.id)).toHaveLength(0);
  });

  it.each(BAD_URLS)("a stored website_url %j is never a fallback target: 404, no click", async (websiteUrl) => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { offer, merchant } = await seed();
    await setFlags({});
    await run("UPDATE merchants SET website_url = ?1 WHERE id = ?2", websiteUrl, merchant.id);
    const res = await call(`/go/o/${offer.id}`);
    expect(res.status).toBe(404);
    expect(res.headers.get("location")).toBeNull();
    expect(goLogs(error).map((l) => l.reason)).toEqual(["website_invalid"]);
    expect(await clicksOf(offer.id)).toHaveLength(0);
  });
});

describe("what never reaches D1", () => {
  /** A D1 whose every entry point throws and counts: a request that gets this far read the database. */
  function untouchableDb() {
    const state = { calls: 0 };
    const DB = new Proxy(testEnv.DB, {
      get(target, prop) {
        if (prop === "prepare" || prop === "batch" || prop === "exec") {
          return () => {
            state.calls++;
            throw new Error("D1 must not be called");
          };
        }
        const value = Reflect.get(target, prop) as unknown;
        return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(target) : value;
      },
    });
    return { env: { ...testEnv, DB } as Bindings, state };
  }

  const NOT_ULIDS = ["01hz8k3m5n7p9q2r4s6t8v0wxy", "01HZ8K3M5N7P9Q2R4S6T8V0WX", "01HZ8K3M5N7P9Q2R4S6T8V0WXYZ", "01HZ8K3M5N7P9Q2R4S6T8V0WXU", "..", "%00", "abc"];
  it.each(NOT_ULIDS)("/go/o/%s is a 404 before any D1 read", async (id) => {
    const { env, state } = untouchableDb();
    const res = await call(`/go/o/${id}`, { env });
    expect(res.status).toBe(404);
    expect(state.calls).toBe(0);
  });

  it.each(["/go/p", "/go/o", "/go/ab", "/go/UPPER", "/go/-x-", "/go/p/some-product/demo", "/go/p/some-product/site", "/go/o/", "/go/some-slug/"])("%s is a 404 before any D1 read (reserved or malformed slug, /go/p/ stays M7's)", async (path) => {
    const { env, state } = untouchableDb();
    const res = await call(path, { env });
    expect(res.status).toBe(404);
    expect(state.calls).toBe(0);
  });
});

describe("methods", () => {
  it.each(["POST", "PUT", "PATCH", "DELETE"])("%s on /go/ with a valid Origin is 405 with Allow: GET, HEAD, and writes nothing", async (method) => {
    const { offer, merchant } = await seed();
    const before = await totalClicks();
    for (const path of [`/go/o/${offer.id}`, `/go/${merchant.slug}`, "/go/p/x/demo"]) {
      const res = await call(path, { method, headers: { origin: "https://vnx.si" } });
      expect(res.status, `${method} ${path}`).toBe(405);
      expect(res.headers.get("allow")).toBe("GET, HEAD");
      expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(res.headers.get("location")).toBeNull();
    }
    expect(await totalClicks()).toBe(before);
  });

  it("OPTIONS is 405; a POST from another Origin is stopped earlier (403)", async () => {
    expect((await call("/go/some-slug", { method: "OPTIONS" })).status).toBe(405);
    expect((await call("/go/some-slug", { method: "POST", headers: { origin: `https://${EVIL}` } })).status).toBe(403);
  });

  it("HEAD redirects with the same headers and records no click, tracked and fallback alike", async () => {
    const { offer } = await seed();
    const head = await call(`/go/o/${offer.id}`, { method: "HEAD" });
    expect(head.status).toBe(302);
    expectRedirectHeaders(head);
    expect(head.headers.get("location")).toContain("https://example.com/r?c=");
    await setFlags({});
    expect((await call(`/go/o/${offer.id}`, { method: "HEAD" })).headers.get("location")).toBe(`https://example.com/?${UTM}`);
    expect(await clicksOf(offer.id)).toHaveLength(0);
  });
});

describe("the click row (Review Focus 7)", () => {
  it("one GET records one row: kind offer, src, locale from a same-host Referer, country, referrer host only, no visitor hash, nothing personal", async () => {
    const { offer } = await seed();
    const { user, cookie } = await signIn("go-click@vnx.si");
    const res = await call(`/go/o/${offer.id}?src=tools`, {
      headers: { referer: "https://vnx.si/vi/tools/x?utm=1", "user-agent": CHROME, "cf-connecting-ip": "203.0.113.9", cookie },
      cf: { country: "VN" },
    });
    expect(res.status).toBe(302);
    const rows = await clicksOf(offer.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ product_id: null, offer_id: offer.id, link_kind: "offer", src: "tools", locale: "vi", visitor_hash: null, country: "VN", referrer_host: "vnx.si", is_bot: 0 });
    expect(Math.abs(Date.now() - Date.parse(rows[0]?.created_at ?? ""))).toBeLessThan(60_000);
    const stored = JSON.stringify(rows[0]);
    for (const secret of ["203.0.113.9", CHROME, user.id, "go-click@vnx.si", cookie, "utm=1"]) expect(stored).not.toContain(secret);
  });

  it.each([
    ["https://vnx.si/zh-hant/tools/x", "zh-Hant", "vnx.si"],
    ["https://news.example.org/a/b?q=1", "en", "news.example.org"],
    ["https://vnx.si.evil.example.net/vi/x", "en", "vnx.si.evil.example.net"],
    [undefined, "en", null],
  ])("Referer %j gives locale %s and referrer_host %s; no cf gives no country", async (referer, locale, host) => {
    const { offer } = await seed();
    await call(`/go/o/${offer.id}?src=zzz`, { headers: referer ? { referer, "user-agent": CHROME } : { "user-agent": CHROME } });
    expect((await clicksOf(offer.id))[0]).toMatchObject({ src: "unknown", locale, referrer_host: host, country: null, is_bot: 0 });
  });

  it.each([[""], ["Googlebot/2.1 (+http://www.google.com/bot.html)"], ["curl/8.5.0"]])("a bot (User-Agent %j) is redirected and its click is recorded with is_bot = 1", async (ua) => {
    const { offer } = await seed();
    const res = await call(`/go/o/${offer.id}`, { headers: { "user-agent": ua } });
    expect(res.status).toBe(302);
    expect((await clicksOf(offer.id))[0]?.is_bot).toBe(1);
  });

  it("a verified bot reported by Cloudflare is marked, and each GET is its own row", async () => {
    const { offer } = await seed();
    await call(`/go/o/${offer.id}`, { headers: { "user-agent": CHROME }, cf: { botManagement: { verifiedBot: true } } });
    await call(`/go/o/${offer.id}`, { headers: { "user-agent": CHROME } });
    const rows = await clicksOf(offer.id);
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.id)).size).toBe(2);
    expect(rows.map((r) => r.is_bot).sort()).toEqual([0, 1]);
  });
});

describe("the click is written through waitUntil", () => {
  /** Wraps the INSERT into outbound_clicks (and only it) so a test can delay or break it. */
  function dbWithInsert(wrap: (run: () => Promise<unknown>) => Promise<unknown>): Bindings {
    const DB = new Proxy(testEnv.DB, {
      get(target, prop) {
        const value = Reflect.get(target, prop) as unknown;
        if (prop !== "prepare") return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(target) : value;
        return (sql: string) => {
          const stmt = target.prepare(sql);
          if (!sql.includes("INSERT INTO outbound_clicks")) return stmt;
          return { bind: (...args: unknown[]) => { const bound = stmt.bind(...args); return { run: () => wrap(() => bound.run()) }; } } as unknown as D1PreparedStatement;
        };
      },
    });
    return { ...testEnv, DB } as Bindings;
  }
  const fakeCtx = () => {
    const pending: Promise<unknown>[] = [];
    const ctx = { waitUntil: (p: Promise<unknown>) => void pending.push(p), passThroughOnException: () => {}, props: {} } as unknown as ExecutionContext;
    return { ctx, pending };
  };

  it("the response is returned before the write finishes, and the click is stored once the registered promise settles", async () => {
    const { offer } = await seed();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { ctx, pending } = fakeCtx();
    const res = await call(`/go/o/${offer.id}`, { env: dbWithInsert(async (insert) => { await gate; return insert(); }), ctx });
    expect(res.status).toBe(302);
    expect(pending).toHaveLength(1);
    expect(await clicksOf(offer.id)).toHaveLength(0);
    release();
    await Promise.all(pending);
    expect(await clicksOf(offer.id)).toHaveLength(1);
  });

  it("a failing write is logged and does not change the redirect", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { offer } = await seed();
    const { ctx, pending } = fakeCtx();
    const res = await call(`/go/o/${offer.id}`, { env: dbWithInsert(async () => { throw new Error("boom"); }), ctx });
    expect(res.status).toBe(302);
    const location = res.headers.get("location") ?? "";
    await expect(Promise.all(pending)).resolves.toBeDefined();
    expect(goLogs(error)).toEqual([{ event: "go.click_failed", clickId: new URL(location).searchParams.get("c"), error: "Error: boom" }]);
    expect(await clicksOf(offer.id)).toHaveLength(0);
  });

  it("HEAD registers no write; without an ExecutionContext the write is awaited", async () => {
    const { offer } = await seed();
    const { ctx, pending } = fakeCtx();
    await call(`/go/o/${offer.id}`, { method: "HEAD", ctx });
    expect(pending).toHaveLength(0);
    expect((await call(`/go/o/${offer.id}`)).status).toBe(302);
    expect(await clicksOf(offer.id)).toHaveLength(1);
  });
});

describe("flag cache (Review Focus 3, 60 s)", () => {
  it("a change made straight in D1 is not seen until the cache is reset; setFlag clears it at once", async () => {
    const { offer } = await seed();
    const kind = async () => ((await call(`/go/o/${offer.id}`)).headers.get("location") ?? "").includes("/r?c=") ? "tracked" : "fallback";
    expect(await kind()).toBe("tracked");
    await run("UPDATE feature_flags SET enabled = 0 WHERE key = 'affiliate'");
    expect(await kind()).toBe("tracked");
    resetFlagCache();
    expect(await kind()).toBe("fallback");
    await run("UPDATE feature_flags SET enabled = 1 WHERE key = 'affiliate'");
    expect(await kind()).toBe("fallback");
    // setFlag itself clears the cache of this isolate, in both directions (no resetFlagCache here).
    const admin = await ensureUser("go-admin@vnx.si");
    const flip = (enabled: boolean) => setFlag(testEnv.DB, { key: "affiliate", enabled, actorUserId: admin.id, now: new Date().toISOString() });
    await flip(true);
    expect(await kind()).toBe("tracked");
    await flip(false);
    expect(await kind()).toBe("fallback");
  });
});

describe("the rest of the site keeps its own headers", () => {
  it.each(["/", "/products", "/vi/products"])("%s does not get Referrer-Policy: origin (only /go/ sets it)", async (path) => {
    const res = await call(path);
    expect(res.headers.get("referrer-policy")).not.toBe("origin");
  });
});
