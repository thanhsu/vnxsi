import { beforeEach, describe, expect, it } from "vitest";
import { countOpenPublicationsAll } from "../../src/db/request-board.ts";
import { isBoardIndexable, MIN_OPEN_FOR_INDEX, publicMetaDescription } from "../../src/domain/request-board.ts";
import { LOCALES, localizedPath } from "../../src/i18n/locales.ts";
import { countD1Queries, getReq, testEnv } from "../helpers.ts";
import { app, boardEnv, boardFlag, get, listed, mainOf, tag } from "../public/request-board-helpers.ts";

// VNX-2705b (addendum §8, Q13): what the public board tells crawlers.
const HREFLANGS = ["en", "vi", "zh-Hans", "zh-Hant", "x-default"];
const alternates = (html: string) => [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)];
const metaDescription = (html: string) => /<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? null;
const decode = (s: string) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

beforeEach(() => boardFlag(true));

/** Adds open listings until there are `n` (never removes). Returns the count after. */
async function openUpTo(n: number): Promise<number> {
  let have = await countOpenPublicationsAll(testEnv.DB);
  while (have < n) {
    await listed();
    have = await countOpenPublicationsAll(testEnv.DB);
  }
  return have;
}

describe("/requests indexing follows isBoardIndexable(countOpenPublicationsAll) (Q13)", () => {
  // This file starts with no listings, so the first test sees the below-threshold state.
  it("fewer than 5 open: noindex, no canonical, no hreflang, still 200", async () => {
    expect(await countOpenPublicationsAll(testEnv.DB)).toBeLessThan(MIN_OPEN_FOR_INDEX);
    await listed();
    const have = await countOpenPublicationsAll(testEnv.DB);
    expect(isBoardIndexable(have)).toBe(false);
    for (const locale of LOCALES) {
      const res = await get(localizedPath(locale, "/requests"));
      expect(res.status, locale).toBe(200);
      const html = await res.text();
      expect(html, locale).toContain('<meta name="robots" content="noindex"');
      expect(html, locale).not.toContain('rel="canonical"');
      expect(alternates(html), locale).toHaveLength(0);
    }
  });

  it("5 or more open: no noindex, canonical in the page's locale, four hreflang plus x-default", async () => {
    const have = await openUpTo(MIN_OPEN_FOR_INDEX);
    expect(isBoardIndexable(have)).toBe(true);
    for (const locale of LOCALES) {
      const html = await (await get(localizedPath(locale, "/requests"))).text();
      expect(html, locale).not.toContain('content="noindex"');
      expect(html, locale).toContain(`<link rel="canonical" href="https://vnx.si${localizedPath(locale, "/requests")}"`);
      expect(alternates(html).map((a) => a[1]), locale).toEqual(HREFLANGS);
    }
  });

  it("a filtered list (any filter) stays out of the index even over the threshold", async () => {
    await openUpTo(MIN_OPEN_FOR_INDEX);
    const html = await (await get("/requests?category=booking")).text();
    expect(html).toContain('<meta name="robots" content="noindex"');
    expect(html).not.toContain('rel="canonical"');
  });

  it("stays within 8 D1 queries over and under the threshold, filtered or not", async () => {
    // The route has no query that depends on the threshold; measure on both sides of it (the second pass has MIN_OPEN_FOR_INDEX or more open).
    for (const side of ["whatever is open now", "at the threshold"]) {
      if (side === "at the threshold") await openUpTo(MIN_OPEN_FOR_INDEX);
      for (const path of ["/requests", "/requests?category=booking", "/requests?page=1"]) {
        const counted = countD1Queries(boardEnv);
        const res = await app().request(getReq(path), undefined, counted.env);
        expect(res.status, `${side} ${path}`).toBe(200);
        expect(counted.queries(), `${side} ${path}`).toBeLessThanOrEqual(8);
      }
    }
  });
});

describe("publicMetaDescription (160 characters, one line, grapheme-safe)", () => {
  it("is at most 160 code points, ends with an ellipsis only when cut, and never splits a ZWJ emoji", () => {
    expect(publicMetaDescription("  short \n text ")).toBe("short text");
    const family = "👨‍👩‍👧‍👦";
    const long = `${"a".repeat(158)}${family}${"b".repeat(50)}`;
    const out = publicMetaDescription(long);
    expect([...out].length).toBeLessThanOrEqual(160);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toContain("‍…");
    expect(out.replace("…", "")).toBe("a".repeat(158));
    expect([...publicMetaDescription("é".repeat(400))].length).toBeLessThanOrEqual(160);
    expect(publicMetaDescription("x".repeat(160))).toBe("x".repeat(160));
  });
});

describe("open detail page", () => {
  it("has a canonical, 4 hreflang plus x-default, og:type, a public-wording description of at most 160 characters and no JSON-LD", async () => {
    const t = tag();
    const l = await listed({ tag: t, publicTitle: `Open SEO ${t}`, publicDescription: `Wording ${t}\n\n${"salon booking ".repeat(40)}` });
    for (const locale of LOCALES) {
      const path = localizedPath(locale, `/requests/${l.publicId}`);
      const res = await get(path);
      expect(res.status, locale).toBe(200);
      const html = await res.text();
      expect(html, locale).not.toContain('content="noindex"');
      expect(html, locale).toContain(`<link rel="canonical" href="https://vnx.si${path}"`);
      expect(alternates(html).map((a) => a[1]), locale).toEqual(HREFLANGS);
      expect(alternates(html).find((a) => a[1] === "x-default")?.[2], locale).toBe(`https://vnx.si/requests/${l.publicId}`);
      expect(html, locale).toContain('<meta property="og:type" content="website"');
      expect(html, locale).not.toContain("application/ld+json");
      expect(html, locale).not.toContain("JobPosting");
      const desc = decode(metaDescription(html) ?? "");
      expect([...desc].length, locale).toBeGreaterThan(0);
      expect([...desc].length, locale).toBeLessThanOrEqual(160);
      expect(desc, locale).toContain(`Wording ${t}`);
      expect(desc, locale).not.toContain("\n");
      for (const secret of [l.ids.client, l.ids.original, l.ids.adminNote, l.ids.email, l.requestId]) expect(html, secret).not.toContain(secret);
    }
  });

  it("title carries the public title, not the original", async () => {
    const l = await listed({ publicTitle: "Open title check" });
    const html = await (await get(`/requests/${l.publicId}`)).text();
    expect(html).toMatch(/<title>Open title check · VNX\.SI<\/title>/);
    expect(mainOf(html)).not.toContain(l.ids.original);
  });
});

describe("closed detail page", () => {
  it("is 200 with noindex, no canonical, no hreflang and no JSON-LD", async () => {
    const l = await listed({ requestStatus: "closed", closedAt: new Date(Date.now() - 86_400_000).toISOString() });
    for (const locale of LOCALES) {
      const res = await get(localizedPath(locale, `/requests/${l.publicId}`));
      expect(res.status, locale).toBe(200);
      const html = await res.text();
      expect(html, locale).toContain('<meta name="robots" content="noindex"');
      expect(html, locale).not.toContain('rel="canonical"');
      expect(alternates(html), locale).toHaveLength(0);
      expect(html, locale).not.toContain("application/ld+json");
    }
  });
});
