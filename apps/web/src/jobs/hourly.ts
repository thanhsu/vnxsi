import {
  MIN, PUBLIC_STAT_KEYS, countStat, liveEvents, rankTrending, requestByCategory, scarcestCategory, topBuilders, topProductsByCategory, weeklyGrowth,
  type PublicStatKey, type PublicStatValues,
} from "../domain/public-stats.ts";
import {
  loadBuilderTallies, loadCategoryCounts, loadCounts, loadGrowthDays, loadLiveEvents, loadProductCandidates, loadTrendingCandidates, writePublicStat,
} from "../db/public-stats.ts";
import type { Bindings } from "../env.ts";

type HourlyStep = { step: PublicStatKey; run: (env: Bindings, now: string) => Promise<PublicStatValues[PublicStatKey] | null> };
const STEPS: HourlyStep[] = [
  { step: "count_products", run: async (e, n) => countStat((await loadCounts(e.DB, n)).products, MIN.products) },
  { step: "count_builders", run: async (e, n) => countStat((await loadCounts(e.DB, n)).builders, MIN.builders) },
  { step: "count_requests_30d", run: async (e, n) => countStat((await loadCounts(e.DB, n)).requests30d, MIN.requests30d) },
  { step: "count_countries", run: async (e, n) => countStat((await loadCounts(e.DB, n)).countries, MIN.countries) },
  { step: "trending", run: async (e, n) => rankTrending(await loadTrendingCandidates(e.DB, n), n) },
  { step: "request_by_category", run: async (e, n) => { const x = await loadCategoryCounts(e.DB, n); return requestByCategory(x.requests, x.products); } },
  { step: "scarcest_category", run: async (e, n) => { const x = await loadCategoryCounts(e.DB, n); return scarcestCategory(x.requests, x.products); } },
  { step: "growth", run: async (e, n) => weeklyGrowth(await loadGrowthDays(e.DB), n) },
  { step: "top_builders", run: async (e, n) => topBuilders(await loadBuilderTallies(e.DB, n)) },
  { step: "top_products", run: async (e, n) => topProductsByCategory(await loadProductCandidates(e.DB, n)) },
  { step: "live", run: async (e, n) => liveEvents(await loadLiveEvents(e.DB, n), n) },
];

export type HourlyResult =
  | { job: "hourly"; step: PublicStatKey; value: PublicStatValues[PublicStatKey] | null; computedAt: string }
  | { job: "hourly"; step: PublicStatKey; error: string };
export async function runHourly(env: Bindings, now: Date): Promise<HourlyResult[]> {
  const iso = now.toISOString(); const results: HourlyResult[] = [];
  for (const { step, run } of STEPS) try {
    const value = await run(env, iso); await writePublicStat(env.DB, step, value, iso);
    const result: HourlyResult = { job: "hourly", step, value, computedAt: iso }; console.log(JSON.stringify(result)); results.push(result);
  } catch (err) { const result: HourlyResult = { job: "hourly", step, error: String(err) }; console.error(JSON.stringify(result)); results.push(result); }
  return results;
}
