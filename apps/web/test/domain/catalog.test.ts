import { describe, expect, it } from "vitest";
import {
  BADGE_SCORE,
  catalogSearchParams,
  ftsPhrase,
  isCatalogFiltered,
  likePattern,
  normalizeQuery,
  parseCatalogQuery,
  parsePage,
  parseUsdCents,
  searchPlan,
  searchTerms,
  topBadge,
} from "../../src/domain/catalog.ts";

describe("normalizeQuery", () => {
  it("trims, collapses whitespace, drops control characters and composes to NFC", () => {
    expect(normalizeQuery("  đặt \t\n lịch  ")).toBe("đặt lịch");
    expect(normalizeQuery("a\u0000b​c")).toBe("a b c");
    // "e" + combining circumflex + combining dot below → "ệ"
    expect(normalizeQuery("lệ")).toBe("lệ");
  });

  it("caps the length at 100 code points without splitting a surrogate pair", () => {
    expect(Array.from(normalizeQuery("x".repeat(500)))).toHaveLength(100);
    const emoji = normalizeQuery("😀".repeat(150));
    expect(Array.from(emoji)).toHaveLength(100);
    expect(emoji).toBe("😀".repeat(100));
  });

  it("treats anything but a string as empty", () => {
    expect(normalizeQuery(undefined)).toBe("");
    expect(normalizeQuery(["a"])).toBe("");
  });
});

describe("searchTerms / searchPlan (spec §8.7)", () => {
  it("de-duplicates terms case-insensitively and keeps at most 8", () => {
    expect(searchTerms("CRM crm Spa")).toEqual(["CRM", "Spa"]);
    expect(searchTerms("a b c d e f g h i j")).toHaveLength(8);
    expect(searchTerms("")).toEqual([]);
  });

  it("browses without a query", () => {
    expect(searchPlan("")).toEqual({ mode: "browse" });
  });

  it("uses LIKE only when every term has 1–2 characters", () => {
    expect(searchPlan("预约")).toEqual({ mode: "like", likeTerms: ["预约"] });
    expect(searchPlan("AI hr")).toEqual({ mode: "like", likeTerms: ["AI", "hr"] });
  });

  it("sends terms of 3+ characters to FTS and keeps short ones as LIKE filters", () => {
    expect(searchPlan("đặt lịch")).toEqual({ mode: "fts", match: '"đặt" "lịch"', likeTerms: [] });
    expect(searchPlan("AI chatbot")).toEqual({ mode: "fts", match: '"chatbot"', likeTerms: ["AI"] });
    expect(searchPlan("预约系统")).toEqual({ mode: "fts", match: '"预约系统"', likeTerms: [] });
  });

  it("quotes every FTS term so user text never becomes an operator", () => {
    expect(ftsPhrase('say "hi"')).toBe('"say ""hi"""');
    expect(searchPlan("foo AND NEAR(x name:y")).toEqual({ mode: "fts", match: '"foo" "AND" "NEAR(x" "name:y"', likeTerms: [] });
  });

  it("escapes LIKE wildcards", () => {
    expect(likePattern("50%_off\\")).toBe("%50\\%\\_off\\\\%");
  });
});

describe("parseUsdCents / parsePage", () => {
  it("reads whole dollars and up to 2 decimals, 0 – 100000", () => {
    expect(parseUsdCents("19")).toBe(1900);
    expect(parseUsdCents("19.5")).toBe(1950);
    expect(parseUsdCents(" 0.05 ")).toBe(5);
    expect(parseUsdCents("0")).toBe(0);
    expect(parseUsdCents("100000")).toBe(10_000_000);
    for (const bad of ["100000.01", "1.234", "-1", "1e3", "abc", "", " ", "1,5"]) expect(parseUsdCents(bad), bad).toBeNull();
    expect(parseUsdCents(undefined)).toBeNull();
  });

  it("accepts pages 1–9999 and reads anything else as 1", () => {
    expect(parsePage("2")).toBe(2);
    expect(parsePage("9999")).toBe(9999);
    for (const bad of ["0", "-1", "abc", "1e3", "01", "10000", "2.5", "", undefined]) expect(parsePage(bad), String(bad)).toBe(1);
  });
});

describe("parseCatalogQuery", () => {
  it("keeps valid filters and ignores invalid or unknown ones", () => {
    const q = parseCatalogQuery({ q: " spa ", category: "crm", delivery: "source", badge: "in_production", lang: "zh-Hant", min: "10", max: "99.99", page: "3", sort: "paid", boost: "1" });
    expect(q).toEqual({ q: "spa", category: "crm", delivery: "source", badge: "in_production", lang: "zh-Hant", minCents: 1000, maxCents: 9999, page: 3 });
    expect(parseCatalogQuery({ category: "nope", delivery: "", badge: "listed", lang: "zh", min: "x", page: "0" })).toEqual({
      q: "",
      category: null,
      delivery: null,
      badge: null,
      lang: null,
      minCents: null,
      maxCents: null,
      page: 1,
    });
  });

  it("swaps a minimum above the maximum", () => {
    expect(parseCatalogQuery({ min: "500", max: "19" })).toMatchObject({ minCents: 1900, maxCents: 50000 });
  });

  it("has exactly the spec's inputs, so nothing else can reach the ranking (ADR-004)", () => {
    expect(Object.keys(parseCatalogQuery({})).sort()).toEqual(["badge", "category", "delivery", "lang", "maxCents", "minCents", "page", "q"]);
  });

  it("reports whether anything narrows the list", () => {
    expect(isCatalogFiltered(parseCatalogQuery({ page: "2" }))).toBe(false);
    expect(isCatalogFiltered(parseCatalogQuery({ q: "x" }))).toBe(true);
    expect(isCatalogFiltered(parseCatalogQuery({ min: "0" }))).toBe(true);
  });

  it("writes the query back in a fixed order, without page 1 or empty values", () => {
    const q = parseCatalogQuery({ q: "đặt lịch", lang: "vi", min: "1.5", page: "4" });
    expect(catalogSearchParams(q, 1)).toBe("?q=%C4%91%E1%BA%B7t+l%E1%BB%8Bch&lang=vi&min=1.5");
    expect(catalogSearchParams(q, 2)).toBe("?q=%C4%91%E1%BA%B7t+l%E1%BB%8Bch&lang=vi&min=1.5&page=2");
    expect(catalogSearchParams(parseCatalogQuery({}), 1)).toBe("");
    expect(catalogSearchParams(parseCatalogQuery({}), 3)).toBe("?page=3");
  });
});

describe("badge score (spec §8.7)", () => {
  it("ranks in_production over demo_verified over listed", () => {
    expect(BADGE_SCORE).toEqual({ listed: 1, demo_verified: 2, in_production: 3 });
    expect(topBadge(3)).toBe("in_production");
    expect(topBadge(1)).toBe("listed");
    expect(topBadge(0)).toBeNull();
  });
});
