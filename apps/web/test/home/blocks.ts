import { createApp } from "../../src/app.ts";
import { writePublicStat } from "../../src/db/public-stats.ts";
import { MIN, NUMBER_KEYS, liveEvents, rankTrending, requestByCategory, scarcestCategory, topBuilders, topProductsByCategory, weeklyGrowth, type BuilderTally, type LiveEvent, type NumberKey, type ProductCandidate, type TrendingCandidate } from "../../src/domain/public-stats.ts";
import { utcDay } from "../../src/domain/stats.ts";
import type { Bindings } from "../../src/env.ts";
import { testEnv } from "../helpers.ts";

export const DB = testEnv.DB;
/** A snapshot time that is fresh now (the route reads the real clock). */
export const fresh = (minutesAgo = 1): string => new Date(Date.now() - minutesAgo * 60_000).toISOString();
export const clearStats = () => DB.prepare("DELETE FROM public_stats").run();
export const getHome = async (path = "/", env: Bindings = testEnv, cookie?: string): Promise<string> =>
  (await createApp().request(new Request(`https://vnx.si${path}`, { headers: cookie ? { cookie } : {} }), undefined, env)).text();
/** One block: the whole <section id="…">…</section>, or "" when it is not on the page. */
export const block = (html: string, id: string): string => new RegExp(`<section[^>]*id="${id}"[\\s\\S]*?</section>`).exec(html)?.[0] ?? "";

export const COUNT_MIN: Record<NumberKey, number> = { count_products: MIN.products, count_builders: MIN.builders, count_requests_30d: MIN.requests30d, count_countries: MIN.countries };
export const trendingCandidates = (n: number, views: number = MIN.trendingScore): TrendingCandidate[] =>
  Array.from({ length: n }, (_, i) => ({ productId: `t${i}`, slug: `trend-${i}`, name: `Trend ${i}`, tagline: "Tagline", category: "crm" as const, builderHandle: `tb${i}`, builderName: `TB ${i}`, daily: { [utcDay(new Date())]: { views } } }));

export const eventList = (n: number): LiveEvent[] =>
  Array.from({ length: n }, (_, i) => ({ id: `e${i}`, at: new Date(Date.now() - (i + 1) * 60_000).toISOString(), kind: "product_published" as const, productName: `Live product ${i}`, slug: `live-${i}` }));
export const tally = (i: number, over: Partial<BuilderTally> = {}): BuilderTally => ({ userId: `u${i}`, handle: `tb-${i}`, name: `Top builder ${i}`, selected: 0, answered: 0, replyMinutes: [], verified: 0, ...over });
export const candidate = (i: number, over: Partial<ProductCandidate> = {}): ProductCandidate => ({ id: `p${i}`, slug: `tp-${i}`, name: `Top product ${i}`, category: "crm", builderHandle: "tb", builderName: "TB", badgeScore: 1, inquiries30d: 0, publishedAt: `2026-10-0${i + 1}T00:00:00.000Z`, ...over });
const WEEKS = { products: { "2026-09-14": 1, "2026-09-21": 1, "2026-09-28": 1, "2026-10-05": 1 }, builders: {} };

/** Every key written exactly at its threshold: all blocks shown. */
export async function seedSnapshot(at = fresh()): Promise<void> {
  await clearStats();
  for (const key of NUMBER_KEYS) await writePublicStat(DB, key, COUNT_MIN[key], at);
  await writePublicStat(DB, "trending", rankTrending(trendingCandidates(MIN.trendingItems), new Date()), at);
  await writePublicStat(DB, "live", liveEvents(eventList(MIN.liveEvents), new Date()), at);
  const requests = { crm: 4, ecommerce: 3, booking: 3 };
  await writePublicStat(DB, "request_by_category", requestByCategory(requests, { crm: 1 }), at);
  await writePublicStat(DB, "scarcest_category", scarcestCategory(requests, { crm: 1 }), at);
  await writePublicStat(DB, "growth", weeklyGrowth(WEEKS, new Date("2026-10-05T12:05:00.000Z")), at);
  await writePublicStat(DB, "top_builders", topBuilders([0, 1, 2].map((i) => tally(i, { selected: MIN.selected, replyMinutes: Array<number>(MIN.fastSamples).fill(10), verified: MIN.verified }))), at);
  await writePublicStat(DB, "top_products", topProductsByCategory([candidate(0)]), at);
}

/** A D1 that records every prepared SQL, and throws on a statement containing `failOn`. */
export function spyDb(sink: string[], failOn?: string): D1Database {
  return new Proxy(DB, {
    get(db, prop) {
      if (prop === "prepare") return (sql: string) => { if (failOn && sql.includes(failOn)) throw new Error(`boom on ${failOn}`); sink.push(sql); return db.prepare(sql); };
      const value = Reflect.get(db, prop) as unknown;
      return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(db) : value;
    },
  }) as D1Database;
}
