import { describe, expect, it } from "vitest";
import {
  MIN, STALE_AFTER_MS, FUTURE_SKEW_MS, addDays, changePercent, countStat, isFresh, isoWeek, isoWeekStart, lastDays, liveEvents, median, pickFresh,
  rankTrending, requestByCategory, scarcestCategory, topBuilders, topProductsByCategory, trendingScore, weeklyGrowth,
  type BuilderTally, type LiveEvent, type ProductCandidate, type TrendingCandidate,
} from "../../src/domain/public-stats.ts";

const NOW = "2026-10-05T12:05:00.000Z";

describe("thresholds are the spec's (spec §8.11)", () => {
  it("MIN holds exactly the spec numbers", () => {
    expect(MIN).toEqual({ products: 10, builders: 10, requests30d: 10, countries: 3, trendingScore: 20, trendingItems: 6, categoryTotal: 10, categoryRequests: 3, scarcestRequests: 3, growthWeeks: 4, selected: 2, fastSamples: 5, verified: 1, tabBuilders: 3, liveEvents: 5 });
  });
});

describe("countStat: below n → null, at n and above → the number", () => {
  it.each([[9, null], [10, 10], [11, 11]])("products %i", (n, want) => expect(countStat(n, MIN.products)).toBe(want));
  it.each([[2, null], [3, 3], [4, 4]])("countries %i", (n, want) => expect(countStat(n, MIN.countries)).toBe(want));
  it("0 is below any threshold", () => expect(countStat(0, 10)).toBeNull());
});

describe("trending", () => {
  it("scores inquiries × 5 + demo_clicks × 2 + views (hand example: 2, 3, 4 → 20)", () => {
    expect(trendingScore({ inquiries: 2, demoClicks: 3, views: 4 })).toBe(20);
    expect(trendingScore({ inquiries: 0, demoClicks: 0, views: 0 })).toBe(0);
    expect(trendingScore({ inquiries: 1, demoClicks: 0, views: 0 })).toBe(5);
    expect(trendingScore({ inquiries: 0, demoClicks: 1, views: 0 })).toBe(2);
  });

  it("percent change rounds down, never up, and is null when the previous 7 days are 0", () => {
    expect(changePercent(0, 10)).toBeNull();
    expect(changePercent(3, 4)).toBe(33); // 33.33 → 33
    expect(changePercent(3, 5)).toBe(66); // 66.67 → 66, not 67
    expect(changePercent(10, 10)).toBe(0);
    expect(changePercent(3, 2)).toBe(-34); // -33.33 → -34 (floor)
    expect(changePercent(4, 0)).toBe(-100);
  });

  const day = (n: number) => addDays("2026-10-05", -n);
  const cand = (id: string, daily: TrendingCandidate["daily"]): TrendingCandidate => ({ productId: id, slug: id, name: id, tagline: "t", category: "booking", builderHandle: "h", builderName: "H", daily });
  // `views` on today only: the score of the current 7 days is `views`.
  const scored = (id: string, views: number, prevViews = 0) => cand(id, { [day(0)]: { views }, [day(7)]: { views: prevViews } });

  it("a product needs 20 points: 19 is out, 20 and 21 are in; fewer than 6 in → null", () => {
    const five = ["a", "b", "c", "d", "e"].map((id) => scored(id, 100));
    expect(rankTrending([...five, scored("f", 19)], NOW)).toBeNull();
    expect(rankTrending([...five, scored("f", 20)], NOW)?.map((i) => i.productId)).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect(rankTrending([...five, scored("f", 21)], NOW)).toHaveLength(6);
    expect(rankTrending(five, NOW)).toBeNull(); // 5 eligible < 6
  });

  it("keeps the top 6 by score, ties by product id, with sparkline and change", () => {
    const list = ["g", "f", "e", "d", "c", "b", "a"].map((id, i) => scored(id, 30 + i, 10));
    const top = rankTrending(list, NOW)!;
    expect(top).toHaveLength(6);
    expect(top.map((i) => i.productId)).toEqual(["a", "b", "c", "d", "e", "f"]); // views 36 … 31; "g" (30) is cut
    expect(top[0]!.score).toBeGreaterThanOrEqual(top[5]!.score);
    const tie = rankTrending(["b", "a", "d", "c", "f", "e"].map((id) => scored(id, 25)), NOW)!;
    expect(tie.map((i) => i.productId)).toEqual(["a", "b", "c", "d", "e", "f"]);
    const one = rankTrending(["a", "b", "c", "d", "e", "f"].map((id) => scored(id, 25, 20)), NOW)![0]!;
    expect(one.score).toBe(25);
    expect(one.previousScore).toBe(20);
    expect(one.changePct).toBe(25);
    expect(one.sparkline).toHaveLength(14);
    expect(one.sparkline[13]).toBe(25); // today is the last point
    expect(one.sparkline[6]).toBe(20); // 7 days ago
    expect(one).not.toHaveProperty("daily");
  });

  it("day 6 is the oldest day of the current window and day 7 the newest of the previous one", () => {
    const [it0] = rankTrending(["a", "b", "c", "d", "e", "f"].map((id) => cand(id, { [day(6)]: { views: 20 }, [day(7)]: { views: 5 } })), NOW)!;
    expect(it0!.score).toBe(20);
    expect(it0!.previousScore).toBe(5);
  });

  it("days outside the 14 are ignored; a missing day counts as 0", () => {
    const [it0] = rankTrending(["a", "b", "c", "d", "e", "f"].map((id) => cand(id, { [day(0)]: { views: 20 }, [day(14)]: { views: 999 } })), NOW)!;
    expect(it0!.score).toBe(20);
    expect(it0!.previousScore).toBe(0);
  });
});

describe("requestByCategory", () => {
  it("is null below 10 requests in total, shown at 10", () => {
    expect(requestByCategory({ booking: 9 }, {})).toBeNull();
    expect(requestByCategory({ booking: 10 }, { booking: 2 })).toEqual([{ category: "booking", requests: 10, products: 2 }]);
  });
  it("a category with 2 requests folds into other; with 3 it keeps its name", () => {
    expect(requestByCategory({ booking: 8, crm: 2 }, { booking: 1, crm: 4 })).toEqual([
      { category: "booking", requests: 8, products: 1 },
      { category: "other", requests: 2, products: 4 },
    ]);
    expect(requestByCategory({ booking: 7, crm: 3 }, {})!.map((r) => r.category)).toEqual(["booking", "crm"]);
  });
  it("folds the real other category and categories that only have products, and never names a small one", () => {
    const rows = requestByCategory({ booking: 6, other: 3, hr: 1, finance: 2 }, { hr: 1, education: 5 })!;
    expect(rows).toEqual([{ category: "booking", requests: 6, products: 0 }, { category: "other", requests: 6, products: 6 }]);
    expect(JSON.stringify(rows)).not.toMatch(/hr|finance|education/);
  });
  it("orders by requests then category order, other last; no empty other row", () => {
    const rows = requestByCategory({ crm: 4, booking: 4, finance: 4 }, {})!;
    expect(rows.map((r) => r.category)).toEqual(["booking", "crm", "finance"]);
  });
});

describe("scarcestCategory", () => {
  it("is null when the 30-day request total is under 10, even if a category has 3 requests", () => {
    expect(scarcestCategory({ booking: 3, crm: 3, hr: 3 }, {})).toBeNull(); // total 9
    expect(scarcestCategory({ booking: 4, crm: 3, hr: 3 }, { booking: 1, crm: 1, hr: 1 })).toEqual({ category: "booking", requests: 4, products: 1 }); // total 10
  });
  it("needs 3 requests in the category: 2 never wins, even with no product at all", () => {
    expect(scarcestCategory({ booking: 2, crm: 8 }, { crm: 4 })).toEqual({ category: "crm", requests: 8, products: 4 });
  });
  it("highest requests per product wins; zero products beats any ratio; ties by requests then category order", () => {
    expect(scarcestCategory({ booking: 6, crm: 6 }, { booking: 3, crm: 2 })!.category).toBe("crm"); // 2 vs 3 per product
    expect(scarcestCategory({ booking: 30, crm: 3 }, { booking: 1, crm: 0 })!.category).toBe("crm");
    expect(scarcestCategory({ booking: 6, crm: 3, hr: 1 }, { booking: 2, crm: 1 })!.category).toBe("booking"); // 3 vs 3: more requests
    expect(scarcestCategory({ booking: 3, crm: 3, hr: 4 }, { booking: 1, crm: 1, hr: 100 })!.category).toBe("booking"); // full tie: category order
    expect(scarcestCategory({ booking: 3, crm: 3, hr: 4 }, {})!.category).toBe("hr"); // all infinite: more requests
    expect(scarcestCategory({ booking: 4, crm: 4, hr: 2 }, {})!.category).toBe("booking");
  });
  it("never chooses the other category", () => {
    expect(scarcestCategory({ other: 9, booking: 3 }, {})!.category).toBe("booking");
    expect(scarcestCategory({ other: 12 }, {})).toBeNull();
  });
});

describe("ISO weeks", () => {
  it.each([
    ["2026-01-01", "2026-W01"], ["2025-12-29", "2026-W01"], ["2027-01-01", "2026-W53"], ["2020-12-31", "2020-W53"],
    ["2021-01-03", "2020-W53"], ["2021-01-04", "2021-W01"], ["2024-12-30", "2025-W01"], ["2026-10-05", "2026-W41"], ["2026-10-11", "2026-W41"], ["2026-10-12", "2026-W42"],
  ])("%s is %s", (day, want) => expect(isoWeek(day)).toBe(want));
  it("the week starts on Monday", () => {
    expect(isoWeekStart("2026-10-05")).toBe("2026-10-05");
    expect(isoWeekStart("2026-10-11")).toBe("2026-10-05");
    expect(isoWeekStart("2026-01-01")).toBe("2025-12-29");
  });
  it("lastDays ends today (UTC) and has n days", () => {
    expect(lastDays("2026-10-05T23:59:59.999Z", 3)).toEqual(["2026-10-03", "2026-10-04", "2026-10-05"]);
    expect(lastDays("2026-03-01T00:00:00.000Z", 2)).toEqual(["2026-02-28", "2026-03-01"]);
  });
});

describe("weeklyGrowth", () => {
  it("needs 4 ISO weeks: first event in week W-2 (3 weeks incl. current) → null; W-3 → 4 points", () => {
    expect(weeklyGrowth({ products: { "2026-09-21": 1 }, builders: {} }, NOW)).toBeNull(); // W39, W40, W41
    const g = weeklyGrowth({ products: { "2026-09-14": 1 }, builders: {} }, NOW)!; // W38 .. W41
    expect(g.map((p) => p.week)).toEqual(["2026-W38", "2026-W39", "2026-W40", "2026-W41"]);
  });
  it("is null with no data at all", () => expect(weeklyGrowth({ products: {}, builders: {} }, NOW)).toBeNull());
  it("accumulates both series from the first week, empty weeks keep the total", () => {
    const g = weeklyGrowth({ products: { "2026-09-14": 2, "2026-09-30": 1 }, builders: { "2026-09-21": 3 } }, NOW)!;
    expect(g).toEqual([
      { week: "2026-W38", products: 2, builders: 0 },
      { week: "2026-W39", products: 2, builders: 3 },
      { week: "2026-W40", products: 3, builders: 3 },
      { week: "2026-W41", products: 3, builders: 3 },
    ]);
  });
  it("crosses the year boundary by ISO week and keeps at most 52 weeks while still counting older ones", () => {
    const g = weeklyGrowth({ products: { "2025-12-29": 1, "2024-01-01": 5 }, builders: {} }, "2026-01-12T00:00:00.000Z")!;
    expect(g).toHaveLength(52);
    expect(g.at(-1)).toEqual({ week: "2026-W03", products: 6, builders: 0 });
    const small = weeklyGrowth({ products: { "2025-12-22": 1 }, builders: {} }, "2026-01-12T00:00:00.000Z")!;
    expect(small.map((p) => p.week)).toEqual(["2025-W52", "2026-W01", "2026-W02", "2026-W03"]);
  });
  it("ignores events dated after now", () => {
    expect(weeklyGrowth({ products: { "2026-09-14": 1, "2026-11-01": 9 }, builders: {} }, NOW)!.at(-1)!.products).toBe(1);
  });
});

describe("median", () => {
  it("odd, even (floor of the mean of the middle two), single, unsorted", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2])).toBe(1);
    expect(median([1, 4, 2, 3])).toBe(2);
    expect(median([7])).toBe(7);
  });
});

describe("topBuilders (spec §8.11): tab thresholds 2 / 5 / 1 and 3 builders per tab", () => {
  const b = (handle: string, o: Partial<BuilderTally> = {}): BuilderTally => ({ userId: handle, handle, name: handle.toUpperCase(), selected: 0, answered: 0, replyMinutes: [], verified: 0, ...o });
  const many = (n: number, o: (i: number) => Partial<BuilderTally>) => Array.from({ length: n }, (_, i) => b(`b${i}`, o(i)));

  it("selected: a builder needs selected + answered ≥ 2 (1 out, 2 in); the tab needs 3 builders", () => {
    const three = (v: number) => many(3, () => ({ selected: v }));
    expect(topBuilders(three(1))).toBeNull();
    expect(topBuilders(three(2))!.selected).toHaveLength(3);
    expect(topBuilders([...many(2, () => ({ selected: 5 })), b("x", { selected: 1 })])).toBeNull(); // only 2 eligible
    expect(topBuilders([b("a", { selected: 1, answered: 1 }), b("b", { answered: 2 }), b("c", { selected: 2 })])!.selected!.map((e) => e.value)).toEqual([2, 2, 2]);
  });
  it("fast: a builder needs 5 samples (4 out, 5 in); median ascending; the tab needs 3 builders", () => {
    const three = (n: number) => many(3, (i) => ({ replyMinutes: Array.from({ length: n }, () => 10 + i) }));
    expect(topBuilders(three(4))).toBeNull();
    const fast = topBuilders(three(5))!.fast!;
    expect(fast.map((e) => [e.handle, e.value])).toEqual([["b0", 10], ["b1", 11], ["b2", 12]]);
  });
  it("verified: a builder needs 1 verified product (0 out, 1 in); the tab needs 3 builders", () => {
    expect(topBuilders(many(3, () => ({ verified: 0 })))).toBeNull();
    expect(topBuilders(many(2, () => ({ verified: 1 })))).toBeNull();
    expect(topBuilders(many(3, (i) => ({ verified: 1 + i })))!.verified!.map((e) => e.value)).toEqual([3, 2, 1]);
  });
  it("hides only the tabs that fail; shows the rest; ties by handle; at most 10 rows", () => {
    const list = [...many(11, () => ({ verified: 2 })), b("zed", { selected: 2 })];
    const out = topBuilders(list)!;
    expect(out.selected).toBeNull();
    expect(out.fast).toBeNull();
    expect(out.verified).toHaveLength(10);
    expect(out.verified!.map((e) => e.handle)).toEqual(["b0", "b1", "b10", "b2", "b3", "b4", "b5", "b6", "b7", "b8"]);
  });
  it("exposes only handle, name and value", () => {
    expect(Object.keys(topBuilders(many(3, () => ({ verified: 1 })))!.verified![0]!).sort()).toEqual(["handle", "name", "value"]);
  });
});

describe("topProductsByCategory", () => {
  const p = (id: string, o: Partial<ProductCandidate> = {}): ProductCandidate => ({ id, slug: id, name: id, category: "booking", builderHandle: "h", builderName: "H", badgeScore: 1, inquiries30d: 0, publishedAt: "2026-09-01T00:00:00.000Z", ...o });
  it("orders by badge, then 30-day inquiries, then newest published, then id; 3 per category", () => {
    const out = topProductsByCategory([
      p("old", { publishedAt: "2026-08-01T00:00:00.000Z" }), p("new"), p("insured", { inquiries30d: 1 }), p("gold", { badgeScore: 3 }), p("silver", { badgeScore: 2 }),
    ])!;
    expect(out.booking!.map((x) => x.id)).toEqual(["gold", "silver", "insured"]);
    expect(topProductsByCategory([p("b"), p("a")])!.booking!.map((x) => x.id)).toEqual(["a", "b"]);
  });
  it("only categories with a product; uncategorised are skipped; none → null", () => {
    expect(Object.keys(topProductsByCategory([p("a"), p("b", { category: "crm" })])!)).toEqual(["booking", "crm"]);
    expect(topProductsByCategory([p("a", { category: null })])).toBeNull();
    expect(topProductsByCategory([])).toBeNull();
  });
});

describe("liveEvents: 7 calendar days, newest first, at most 20, hidden under 5", () => {
  const ev = (n: number, ageMs: number): LiveEvent => ({ id: String(n).padStart(4, "0"), kind: "builder_approved", at: new Date(Date.parse(NOW) - ageMs).toISOString(), builderName: `B${n}`, handle: `b${n}` });
  const START = Date.parse("2026-09-29T00:00:00.000Z"); // first of the 7 days ending 2026-10-05
  const atMs = (n: number, ms: number): LiveEvent => ({ ...ev(n, 0), at: new Date(ms).toISOString() });
  it("4 events in 7 days → null; 5 → shown", () => {
    expect(liveEvents([1, 2, 3, 4].map((n) => ev(n, n * 1000)), NOW)).toBeNull();
    expect(liveEvents([1, 2, 3, 4, 5].map((n) => ev(n, n * 1000)), NOW)).toHaveLength(5);
  });
  it("00:00 UTC of the 7th day counts, one millisecond earlier does not", () => {
    const four = [1, 2, 3, 4].map((n) => ev(n, n * 1000));
    expect(liveEvents([...four, atMs(9, START)], NOW)).toHaveLength(5);
    expect(liveEvents([...four, atMs(9, START - 1)], NOW)).toBeNull();
  });
  it("caps at 20, newest first, ignores events after now, and carries no id", () => {
    const out = liveEvents([...Array.from({ length: 25 }, (_, n) => ev(n, (n + 1) * 1000)), ev(99, -1000)], NOW)!;
    expect(out).toHaveLength(20);
    expect(out[0]).toMatchObject({ builderName: "B0" });
    for (const e of out) expect(e).not.toHaveProperty("id");
  });
  it("ties on time go by id descending", () => {
    expect(liveEvents([1, 2, 3, 4, 5].map((n) => ev(n, 1000)), NOW)!.map((e) => (e as { builderName: string }).builderName)).toEqual(["B5", "B4", "B3", "B2", "B1"]);
  });
});

describe("snapshot freshness (stale after 3 hours)", () => {
  const at = (ms: number) => new Date(Date.parse(NOW) - ms).toISOString();
  it("exactly 3 hours old is still fresh, 1 ms more is stale", () => {
    expect(STALE_AFTER_MS).toBe(3 * 60 * 60 * 1000);
    expect(isFresh(at(STALE_AFTER_MS), NOW)).toBe(true);
    expect(isFresh(at(STALE_AFTER_MS + 1), NOW)).toBe(false);
    expect(isFresh(at(0), NOW)).toBe(true);
    expect(isFresh("garbage", NOW)).toBe(false);
  });
  it("a time more than 5 minutes ahead of now is not trusted", () => {
    expect(isFresh(at(-FUTURE_SKEW_MS), NOW)).toBe(true);
    expect(isFresh(at(-FUTURE_SKEW_MS - 1), NOW)).toBe(false);
  });
  it("keeps fresh non-null keys, drops stale, null, unknown and corrupt ones", () => {
    const snap = pickFresh(
      [
        { key: "count_products", value: "12", computedAt: at(60_000) },
        { key: "count_builders", value: "11", computedAt: at(STALE_AFTER_MS + 1) },
        { key: "count_countries", value: "null", computedAt: at(60_000) },
        { key: "count_requests_30d", value: "{oops", computedAt: at(60_000) },
        { key: "not_a_key", value: "1", computedAt: at(60_000) },
      ],
      NOW,
    );
    expect(snap).toEqual({ count_products: { value: 12, computedAt: at(60_000) } });
  });
});
