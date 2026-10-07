import { createApp } from "../../src/app.ts";
import { writePublicStat } from "../../src/db/public-stats.ts";
import { MIN, NUMBER_KEYS, rankTrending, type NumberKey, type TrendingCandidate } from "../../src/domain/public-stats.ts";
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

/** Every key written exactly at its threshold: all blocks shown. 7b adds the remaining keys. */
export async function seedSnapshot(at = fresh()): Promise<void> {
  await clearStats();
  for (const key of NUMBER_KEYS) await writePublicStat(DB, key, COUNT_MIN[key], at);
  await writePublicStat(DB, "trending", rankTrending(trendingCandidates(MIN.trendingItems), new Date()), at);
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
