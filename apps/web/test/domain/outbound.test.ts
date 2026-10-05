import { describe, expect, it } from "vitest";
import type { NotFoundReason } from "../../src/domain/offer.ts";
import {
  CORRUPTION_REASONS,
  OFFER_ID_RE,
  OUTBOUND_CLICK_PURGE_BATCH,
  OUTBOUND_CLICK_PURGE_MAX_BATCHES,
  OUTBOUND_CLICK_RETENTION_DAYS,
  OUTBOUND_SRCS,
  countryOf,
  isBotRequest,
  localeFromReferer,
  parseSrc,
  purgeCutoff,
  referrerHost,
} from "../../src/domain/outbound.ts";

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

describe("parseSrc", () => {
  it("accepts exactly the six places and maps everything else to unknown", () => {
    expect([...OUTBOUND_SRCS]).toEqual(["product_page", "builder_page", "catalog", "home", "article", "tools"]);
    for (const s of OUTBOUND_SRCS) expect(parseSrc(s)).toBe(s);
    for (const bad of ["", "TOOLS", "unknown", "https://evil.example.net", "//evil.example.net", "tools\r\nX: 1", " tools", null, undefined, ["tools"], 5]) {
      expect(parseSrc(bad)).toBe("unknown");
    }
  });
});

describe("isBotRequest (Reviewer decision 12)", () => {
  it.each([[""], [null], [undefined], ["   "], ["Googlebot/2.1 (+http://www.google.com/bot.html)"], ["curl/8.5.0"], ["Wget/1.21"], ["python-requests/2.31"], ["Mozilla/5.0 HeadlessChrome/120.0"], ["facebookexternalhit/1.1"], ["Mozilla/5.0 (compatible; Yahoo! Slurp)"], ["UptimeMonitor/1.0"]])(
    "UA %j is a bot",
    (ua) => {
      expect(isBotRequest(ua, undefined)).toBe(true);
    },
  );

  it("a browser is not, unless Cloudflare marks it a verified bot", () => {
    expect(isBotRequest(CHROME, undefined)).toBe(false);
    expect(isBotRequest(CHROME, { botManagement: { verifiedBot: false } })).toBe(false);
    expect(isBotRequest(CHROME, { botManagement: { verifiedBot: true } })).toBe(true);
  });
});

describe("referrerHost keeps the host only", () => {
  it.each([
    ["https://news.example.org/a/b?q=1#frag", "news.example.org"],
    ["http://Example.COM:8080/x", "example.com"],
    ["https://user:pw@example.org/", "example.org"],
    // IP literals and localhost are not "a website we know by domain": null, so no IP address is ever stored (Privacy).
    ["http://203.0.113.9:3000/", null],
    ["http://[::1]/", null],
    ["http://localhost:5173/", null],
    ["javascript:alert(1)", null],
    ["not a url", null],
    ["", null],
    [null, null],
  ])("%j gives %j", (raw, host) => {
    expect(referrerHost(raw)).toBe(host);
  });
});

describe("localeFromReferer reads the locale from a same-host Referer only", () => {
  it.each([
    ["https://vnx.si/vi/tools/x", "vi"],
    ["https://vnx.si/zh-hans", "zh-Hans"],
    ["https://vnx.si/zh-hant/p/a", "zh-Hant"],
    ["https://vnx.si/tools/x", "en"],
    ["https://vnx.si.evil.example.net/vi/x", "en"],
    ["https://other.example.org/vi/x", "en"],
    ["https://vnx.si:8443/vi/x", "en"],
    ["nonsense", "en"],
    [null, "en"],
  ])("%j gives %j", (referer, locale) => {
    expect(localeFromReferer(referer, "vnx.si")).toBe(locale);
  });
});

describe("countryOf and purgeCutoff", () => {
  it("takes a two-letter upper-case country and nothing else", () => {
    expect(countryOf({ country: "VN" })).toBe("VN");
    for (const bad of [undefined, null, {}, { country: "vn" }, { country: "VNM" }, { country: 5 }, { country: "V\nN" }]) expect(countryOf(bad)).toBeNull();
  });

  it("keeps clicks for 395 days (13 months, Owner 2026-10-05)", () => {
    expect(OUTBOUND_CLICK_RETENTION_DAYS).toBe(395);
    expect(OUTBOUND_CLICK_PURGE_BATCH).toBe(5000);
    expect(OUTBOUND_CLICK_PURGE_MAX_BATCHES).toBe(10);
    expect(purgeCutoff(new Date("2026-10-05T01:00:00.000Z"))).toBe("2025-09-05T01:00:00.000Z");
  });
});

describe("OFFER_ID_RE and CORRUPTION_REASONS", () => {
  it("accepts a 26-character Crockford ULID only", () => {
    expect(OFFER_ID_RE.test("01HZ8K3M5N7P9Q2R4S6T8V0WXY")).toBe(true);
    for (const bad of ["", "01hz8k3m5n7p9q2r4s6t8v0wxy", "01HZ8K3M5N7P9Q2R4S6T8V0WX", "01HZ8K3M5N7P9Q2R4S6T8V0WXYZ", "01HZ8K3M5N7P9Q2R4S6T8V0WXU", "01HZ8K3M5N7P9Q2R4S6T8V0WXI", "../../etc", "01HZ8K3M5N7P9Q2R4S6T8V0WX\n"]) {
      expect(OFFER_ID_RE.test(bad), bad).toBe(false);
    }
  });

  it("logs exactly the corruption reasons of the plan; a new NotFoundReason forces a decision here", () => {
    // The Record type fails to compile when resolveOfferRedirect gains a reason that is not classified below.
    const kind: Record<NotFoundReason, "quiet" | "corrupt"> = {
      offer_missing: "quiet",
      offer_archived: "quiet",
      merchant_missing: "quiet",
      merchant_archived: "quiet",
      subject_merchant: "corrupt",
      program_missing: "corrupt",
      program_merchant: "corrupt",
      template_missing: "corrupt",
      window_invalid: "corrupt",
      invalid_url: "corrupt",
      website_invalid: "corrupt",
    };
    const corrupt = Object.entries(kind).filter(([, k]) => k === "corrupt").map(([r]) => r).sort();
    expect([...CORRUPTION_REASONS].sort()).toEqual(corrupt);
    expect(corrupt).toEqual(["invalid_url", "program_merchant", "program_missing", "subject_merchant", "template_missing", "website_invalid", "window_invalid"]);
  });
});
