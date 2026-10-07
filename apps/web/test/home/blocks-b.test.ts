import { describe, expect, it } from "vitest";
import { writePublicStat } from "../../src/db/public-stats.ts";
import { BADGE_SCORE } from "../../src/domain/catalog.ts";
import { BUILDER_DAYS, LIVE_MAX, MIN, REQUEST_DAYS, liveEvents, requestByCategory, scarcestCategory, topBuilders, topProductsByCategory, weeklyGrowth } from "../../src/domain/public-stats.ts";
import { LOCALES, localizedPath } from "../../src/i18n/locales.ts";
import { t } from "../../src/i18n/t.ts";
import { formatDuration, relativeTime } from "../../src/views/format.ts";
import { CATEGORY_KEY } from "../../src/views/labels.ts";
import { DB, block, candidate, clearStats, eventList, fresh, getHome, tally } from "./blocks.ts";

const count = (html: string, needle: string) => html.split(needle).length - 1;

const label = (c: keyof typeof CATEGORY_KEY) => t("en", CATEGORY_KEY[c]);
const rowsOf = (html: string) => [...html.matchAll(/<th scope="row">([^<]*)<\/th>/g)].map((m) => m[1]);
const NOW = new Date("2026-10-05T12:05:00.000Z");
// total = 2 * categoryRequests + (categoryRequests - 1) + finance; finance = REST at the threshold, REST - 1 one under
const REST = MIN.categoryTotal - 3 * MIN.categoryRequests + 1;
const requests = (finance: number) => ({ crm: MIN.categoryRequests, ecommerce: MIN.categoryRequests, booking: MIN.categoryRequests - 1, finance });

describe("Live (VNX-0703b, moved from 7a)", () => {
  it("4 events hide it, 5 show it, and it never lists more than LIVE_MAX", async () => {
    const now = new Date();
    await clearStats();
    await writePublicStat(DB, "live", liveEvents(eventList(MIN.liveEvents - 1), now), fresh());
    expect(block(await getHome(), "home-live")).toBe("");
    await writePublicStat(DB, "live", liveEvents(eventList(MIN.liveEvents), now), fresh());
    expect(count(block(await getHome(), "home-live"), 'class="home-live-item"')).toBe(MIN.liveEvents);
    await writePublicStat(DB, "live", liveEvents(eventList(LIVE_MAX + 1), now), fresh());
    expect(count(block(await getHome(), "home-live"), 'class="home-live-item"')).toBe(LIVE_MAX);
  });

  it("a new request shows its category and languages, nothing else of it", async () => {
    const at = new Date(Date.now() - 60_000).toISOString();
    const events = [...eventList(MIN.liveEvents - 1), { id: "r", at, kind: "request_new" as const, category: "crm" as const, languages: ["vi" as const] }];
    await clearStats();
    await writePublicStat(DB, "live", liveEvents(events, new Date()), fresh());
    const live = block(await getHome(), "home-live");
    expect(live).toContain(t("en", "home.live.requestNew"));
    expect(live).toContain(t("en", "product.category.crm"));
    expect(live).toContain(t("en", "builder.lang.vi"));
  });

  it("relativeTime picks the largest whole unit", () => {
    const now = new Date("2026-10-05T12:00:00.000Z");
    expect(relativeTime("en", "2026-10-05T10:00:00.000Z", now)).toBe("2 hours ago");
    expect(relativeTime("en", "2026-10-02T12:00:00.000Z", now)).toBe("3 days ago");
  });
});

describe("Market pulse (VNX-0703b)", () => {
  it("chart 1 hides under the request total and folds categories under the minimum into Other", async () => {
    await clearStats();
    await writePublicStat(DB, "request_by_category", requestByCategory(requests(REST - 1), { crm: 1 }), fresh());
    expect(block(await getHome(), "home-pulse")).toBe("");
    await writePublicStat(DB, "request_by_category", requestByCategory(requests(REST), { crm: 1 }), fresh());
    expect(rowsOf(block(await getHome(), "home-pulse"))).toEqual([label("crm"), label("ecommerce"), label("other")]);
  });

  it("the scarcest line needs a category at the request minimum; a table without it still shows", async () => {
    const flat = { crm: 2, ecommerce: 2, booking: 2, finance: 2, hr: 2 }; // total at the threshold, nobody at the minimum
    await clearStats();
    await writePublicStat(DB, "request_by_category", requestByCategory(flat, {}), fresh());
    await writePublicStat(DB, "scarcest_category", scarcestCategory(flat, {}), fresh());
    let html = block(await getHome(), "home-pulse");
    expect(html).not.toBe("");
    expect(html).not.toContain(t("en", "home.pulse.scarcest"));
    const some = requests(REST);
    await writePublicStat(DB, "scarcest_category", scarcestCategory(some, { crm: 1 }), fresh());
    html = block(await getHome(), "home-pulse");
    expect(html).toContain(t("en", "home.pulse.scarcest"));
    expect(html).toContain(`<strong>${label("ecommerce")}</strong>`); // 3 requests and no product beat 3 requests and one product
  });

  it("chart 2 needs the minimum number of ISO weeks", async () => {
    const weeks = (n: number) => ({ products: Object.fromEntries(["2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05"].slice(4 - n).map((d) => [d, 1])), builders: {} });
    await clearStats();
    await writePublicStat(DB, "growth", weeklyGrowth(weeks(MIN.growthWeeks - 1), NOW), fresh());
    expect(block(await getHome(), "home-pulse")).toBe("");
    await writePublicStat(DB, "growth", weeklyGrowth(weeks(MIN.growthWeeks), NOW), fresh());
    expect(rowsOf(block(await getHome(), "home-pulse"))).toHaveLength(MIN.growthWeeks);
  });
});

describe("Top builders (VNX-0703b)", () => {
  const qualifies = { selected: { selected: MIN.selected }, fast: { replyMinutes: Array<number>(MIN.fastSamples).fill(10) }, verified: { verified: MIN.verified } } as const;
  const under = { selected: { selected: MIN.selected - 1 }, fast: { replyMinutes: Array<number>(MIN.fastSamples - 1).fill(10) }, verified: { verified: MIN.verified - 1 } } as const;

  for (const tab of ["selected", "fast", "verified"] as const) {
    it(`${tab}: two qualifying builders hide it, three show it (builder under the minimum does not count)`, async () => {
      await clearStats();
      const two = [tally(0, qualifies[tab]), tally(1, qualifies[tab]), tally(2, under[tab])];
      await writePublicStat(DB, "top_builders", topBuilders(two), fresh());
      expect(block(await getHome(), "home-builders"), tab).toBe("");
      const three = [...two.slice(0, 2), tally(2, qualifies[tab])];
      await writePublicStat(DB, "top_builders", topBuilders(three), fresh());
      const html = block(await getHome(), "home-builders");
      expect(html, tab).toContain(`data-tab="${tab}"`);
      for (const other of (["selected", "fast", "verified"] as const).filter((x) => x !== tab)) expect(html, `${tab}/${other}`).not.toContain(`data-tab="${other}"`);
    });
  }

  it("shows each tab criteria and 'no one pays to appear here' in every locale; the fastest tab shows a duration", async () => {
    await clearStats();
    const all = [0, 1, 2].map((i) => tally(i, { ...qualifies.selected, ...qualifies.fast, ...qualifies.verified }));
    await writePublicStat(DB, "top_builders", topBuilders(all), fresh());
    for (const locale of LOCALES) {
      const html = block(await getHome(localizedPath(locale, "/")), "home-builders");
      expect(html, locale).toContain(t(locale, "home.builders.noPay"));
      expect(html, locale).toContain(t(locale, "home.builders.criteria.selected", { days: BUILDER_DAYS, min: MIN.selected }));
      expect(html, locale).toContain(t(locale, "home.builders.criteria.fast", { days: BUILDER_DAYS, min: MIN.fastSamples }));
      expect(html, locale).toContain(t(locale, "home.builders.criteria.verified", { min: MIN.verified }));
    }
    expect(block(await getHome(), "home-builders")).toContain(formatDuration("en", 10));
    expect(formatDuration("en", 90)).not.toBe(formatDuration("en", 30)); // 90 minutes is shown in hours
  });
});

describe("Top products by category (VNX-0703b)", () => {
  it("hides with no product, shows a chip only for a category that has one, and lists at most three in the domain order", async () => {
    await clearStats();
    await writePublicStat(DB, "top_products", topProductsByCategory([]), fresh());
    expect(block(await getHome(), "home-products")).toBe("");
    const four = [candidate(0), candidate(1, { badgeScore: BADGE_SCORE.in_production }), candidate(2, { badgeScore: BADGE_SCORE.demo_verified }), candidate(3)];
    await writePublicStat(DB, "top_products", topProductsByCategory(four), fresh());
    const html = block(await getHome(), "home-products");
    expect(html).toContain('href="#home-top-crm"');
    expect(html).not.toContain('href="#home-top-ecommerce"');
    const names = [...html.matchAll(/Top product (\d)/g)].map((m) => Number(m[1]));
    expect([...new Set(names)]).toEqual([1, 2, 3]); // in production, demo verified, then the newer of the two listed
    expect(html).toContain(t("en", "home.products.order", { days: REQUEST_DAYS }));
  });
});
