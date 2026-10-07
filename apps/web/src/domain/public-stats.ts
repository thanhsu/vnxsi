import type { WorkLanguage } from "./builder.ts";
import { CATEGORIES, type BadgeKind, type Category } from "./product.ts";
import { utcDay } from "./stats.ts";

/** Public statistics of the homepage (spec §8.11): every formula and threshold. Pure: no Hono, no D1. Nothing here reads money (ADR-004, ADR-007 rule 2). */

export const PUBLIC_STAT_KEYS = ["count_products", "count_builders", "count_requests_30d", "count_countries", "trending", "request_by_category", "scarcest_category", "growth", "top_builders", "top_products", "live"] as const;
export type PublicStatKey = (typeof PUBLIC_STAT_KEYS)[number];

/** Spec §8.11 thresholds. A value below its threshold is `null`, never a smaller number. */
export const MIN = {
  products: 10, builders: 10, requests30d: 10, countries: 3,
  trendingScore: 20, trendingItems: 6,
  categoryTotal: 10, categoryRequests: 3, scarcestRequests: 3,
  growthWeeks: 4,
  selected: 2, fastSamples: 5, verified: 1, tabBuilders: 3,
  liveEvents: 5,
} as const;
/** Trending score weights. */
export const WEIGHT = { inquiries: 5, demoClicks: 2, views: 1 } as const;
export const TREND_DAYS = 7;
export const SPARK_DAYS = 14;
export const REQUEST_DAYS = 30;
export const BUILDER_DAYS = 90;
export const LIVE_DAYS = 7;
export const LIVE_MAX = 20;
export const TOP_PRODUCTS_PER_CATEGORY = 3;
/** Not in the spec (question Q6). */
export const TOP_BUILDERS_LIMIT = 10;
/** Size bound of the stored growth series, not a spec number. */
export const GROWTH_MAX_WEEKS = 52;
/** Spec plan: a block hides when its snapshot is older than 3 hours. */
export const STALE_AFTER_MS = 3 * 60 * 60 * 1000;
/** A snapshot time more than this ahead of `now` is not trusted (clock skew only). */
export const FUTURE_SKEW_MS = 5 * 60 * 1000;
const DAY_MS = 86_400_000;
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const at = (when: string | Date) => (typeof when === "string" ? Date.parse(when) : when.getTime());

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) + n * DAY_MS).toISOString().slice(0, 10);
}
/** The `n` UTC days ending today, oldest first. */
export function lastDays(now: string | Date, n: number): string[] {
  const end = utcDay(now);
  return Array.from({ length: n }, (_, i) => addDays(end, i - (n - 1)));
}
/** 00:00 UTC of the first of the `n` calendar days ending today: every N-day window includes today (controller ruling). */
export function windowStart(now: string | Date, n: number): string {
  return `${lastDays(now, n)[0]}T00:00:00.000Z`;
}
export function isoWeekStart(day: string): string {
  return addDays(day, -((new Date(`${day}T00:00:00.000Z`).getUTCDay() + 6) % 7));
}
/** ISO 8601 week, `YYYY-Www` (the year of the week's Thursday). */
export function isoWeek(day: string): string {
  const thursday = addDays(isoWeekStart(day), 3);
  const year = Number(thursday.slice(0, 4));
  const n = Math.floor((Date.parse(`${thursday}T00:00:00.000Z`) - Date.parse(`${year}-01-01T00:00:00.000Z`)) / DAY_MS / 7) + 1;
  return `${year}-W${String(n).padStart(2, "0")}`;
}
/** Median of whole numbers; for an even count the floor of the mean of the middle two. */
export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? (s[m] as number) : Math.floor(((s[m - 1] as number) + (s[m] as number)) / 2);
}

/** `n` when it reaches `min`, else null. */
export const countStat = (n: number, min: number): number | null => (n >= min ? n : null);

// ---- Homepage "Numbers" and "Founding products" (VNX-0703) ----
export const NUMBER_KEYS = ["count_products", "count_builders", "count_requests_30d", "count_countries"] as const satisfies readonly PublicStatKey[];
export type NumberKey = (typeof NUMBER_KEYS)[number];
/** Spec §5.9: the numbers row hides when fewer than two tiles are left. */
export const MIN_NUMBER_TILES = 2;
/** Owner Q1 (2026-10-05): the Founding products block shows the 6 newest first publications. */
export const FOUNDING_LIMIT = 6;
/** Owner 2026-10-06: the Founding products block waits until there are as many products as it shows. */
export const FOUNDING_MIN = FOUNDING_LIMIT;
export type NumberTile = { key: NumberKey; value: number; computedAt: string };

/** The tiles whose key is fresh and not null, in NUMBER_KEYS order; null when fewer than MIN_NUMBER_TILES. */
export function numberTiles(snapshot: PublicSnapshot): NumberTile[] | null {
  const tiles = NUMBER_KEYS.flatMap((key): NumberTile[] => {
    const hit = snapshot[key];
    return hit ? [{ key, value: hit.value, computedAt: hit.computedAt }] : [];
  });
  return tiles.length >= MIN_NUMBER_TILES ? tiles : null;
}

/** What each homepage block gets: its data, or null (hide). Pure; `HomeBlocks` only maps fields to wrappers. */
export type HomeView<F> = {
  numbers: NumberTile[] | null;
  live: PublicLiveEvent[] | null;
  trending: TrendingItem[] | null;
  founding: readonly F[] | null;
  pulse: { categories: CategoryRow[] | null; scarcest: ScarcestCategory | null; growth: GrowthPoint[] | null } | null;
  builders: TopBuilders | null;
  products: TopProductsByCategory | null;
};
export function homeView<F>(snapshot: PublicSnapshot, founding: readonly F[]): HomeView<F> {
  const trending = snapshot.trending?.value ?? null;
  const categories = snapshot.request_by_category?.value ?? null;
  const growth = snapshot.growth?.value ?? null;
  return {
    numbers: numberTiles(snapshot),
    live: snapshot.live?.value ?? null,
    trending,
    founding: trending === null && founding.length >= FOUNDING_MIN ? founding : null,
    pulse: categories || growth ? { categories, scarcest: snapshot.scarcest_category?.value ?? null, growth } : null,
    builders: snapshot.top_builders?.value ?? null,
    products: snapshot.top_products?.value ?? null,
  };
}

// ---- Trending ----
export type DayCounts = { views: number; demoClicks: number; inquiries: number };
export const trendingScore = (c: DayCounts): number => c.inquiries * WEIGHT.inquiries + c.demoClicks * WEIGHT.demoClicks + c.views * WEIGHT.views;
/** Percent change, rounded down; null when there is nothing before to compare with. */
export const changePercent = (previous: number, current: number): number | null => (previous <= 0 ? null : Math.floor(((current - previous) * 100) / previous));

export type TrendingCandidate = { productId: string; slug: string; name: string; tagline: string; category: Category | null; builderHandle: string; builderName: string; daily: Record<string, Partial<DayCounts>> };
export type TrendingItem = Omit<TrendingCandidate, "daily"> & { score: number; previousScore: number; changePct: number | null; sparkline: number[] };

/** The 6 highest scores of the last 7 days, each ≥ 20; fewer than 6 products qualify → null (Founding products). */
export function rankTrending(candidates: TrendingCandidate[], now: string | Date): TrendingItem[] | null {
  const days = lastDays(now, SPARK_DAYS);
  const items = candidates.map((c): TrendingItem => {
    const { daily, ...meta } = c;
    const sparkline = days.map((d) => trendingScore({ views: daily[d]?.views ?? 0, demoClicks: daily[d]?.demoClicks ?? 0, inquiries: daily[d]?.inquiries ?? 0 }));
    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
    const previousScore = sum(sparkline.slice(0, TREND_DAYS));
    const score = sum(sparkline.slice(TREND_DAYS));
    return { ...meta, score, previousScore, changePct: changePercent(previousScore, score), sparkline };
  });
  const eligible = items.filter((i) => i.score >= MIN.trendingScore).sort((a, b) => b.score - a.score || cmp(a.productId, b.productId));
  return eligible.length >= MIN.trendingItems ? eligible.slice(0, MIN.trendingItems) : null;
}

// ---- Market pulse ----
export type CategoryCounts = Partial<Record<Category, number>>;
export type CategoryRow = { category: Category; requests: number; products: number };
export type ScarcestCategory = CategoryRow;

/** 30-day requests by category beside listed products; categories under 3 requests (and `other`) fold into one "other" row. */
export function requestByCategory(requests: CategoryCounts, products: CategoryCounts): CategoryRow[] | null {
  const total = CATEGORIES.reduce((n, c) => n + (requests[c] ?? 0), 0);
  if (total < MIN.categoryTotal) return null;
  const named: CategoryRow[] = [];
  const other: CategoryRow = { category: "other", requests: 0, products: 0 };
  for (const c of CATEGORIES) {
    const r = requests[c] ?? 0;
    const p = products[c] ?? 0;
    if (c !== "other" && r >= MIN.categoryRequests) named.push({ category: c, requests: r, products: p });
    else {
      other.requests += r;
      other.products += p;
    }
  }
  named.sort((a, b) => b.requests - a.requests || CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category));
  return other.requests > 0 || other.products > 0 ? [...named, other] : named;
}

/**
 * The category with the highest requests-per-product (no product = infinite), among those with ≥ 3 requests. Null when the 30-day total
 * is under 10 (it sits in the same chart as requestByCategory) and `other` is never chosen (it is not a market segment).
 */
export function scarcestCategory(requests: CategoryCounts, products: CategoryCounts): ScarcestCategory | null {
  if (CATEGORIES.reduce((n, c) => n + (requests[c] ?? 0), 0) < MIN.categoryTotal) return null;
  const rows = CATEGORIES.filter((c) => c !== "other" && (requests[c] ?? 0) >= MIN.scarcestRequests).map((c): CategoryRow => ({ category: c, requests: requests[c] ?? 0, products: products[c] ?? 0 }));
  const ratioOrder = (a: CategoryRow, b: CategoryRow): number => {
    if (a.products === 0 && b.products === 0) return 0;
    if (a.products === 0) return -1;
    if (b.products === 0) return 1;
    return b.requests * a.products - a.requests * b.products; // a first when a.requests/a.products is larger
  };
  rows.sort((a, b) => ratioOrder(a, b) || b.requests - a.requests || CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category));
  return rows[0] ?? null;
}

// ---- Growth ----
export type GrowthPoint = { week: string; products: number; builders: number };

/** Cumulative published products and approved builders per ISO week, from the first event to this week; under 4 weeks → null. */
export function weeklyGrowth(days: { products: Record<string, number>; builders: Record<string, number> }, now: string | Date): GrowthPoint[] | null {
  const today = utcDay(now);
  const entries = [...Object.entries(days.products), ...Object.entries(days.builders)].filter(([d]) => d <= today).sort(([a], [b]) => cmp(a, b));
  if (entries.length === 0) return null;
  const weeks: string[] = [];
  for (let w = isoWeekStart(entries[0]![0]); w <= isoWeekStart(today); w = addDays(w, 7)) weeks.push(w);
  if (weeks.length < MIN.growthWeeks) return null;
  let products = 0;
  let builders = 0;
  const points = weeks.map((w): GrowthPoint => {
    for (const [d, n] of Object.entries(days.products)) if (d <= today && isoWeekStart(d) === w) products += n;
    for (const [d, n] of Object.entries(days.builders)) if (d <= today && isoWeekStart(d) === w) builders += n;
    return { week: isoWeek(w), products, builders };
  });
  return points.slice(-GROWTH_MAX_WEEKS);
}

// ---- Top builders ----
export type BuilderTally = { userId: string; handle: string; name: string; selected: number; answered: number; replyMinutes: number[]; verified: number };
export type TopBuilderEntry = { handle: string; name: string; value: number };
/** A tab is null when fewer than 3 builders qualify. `value`: count, median minutes, count. */
export type TopBuilders = { selected: TopBuilderEntry[] | null; fast: TopBuilderEntry[] | null; verified: TopBuilderEntry[] | null };

export function topBuilders(tallies: BuilderTally[]): TopBuilders | null {
  const tab = (value: (t: BuilderTally) => number | null, ascending: boolean): TopBuilderEntry[] | null => {
    const rows = tallies.flatMap((t) => {
      const v = value(t);
      return v === null ? [] : [{ handle: t.handle, name: t.name, value: v }];
    });
    if (rows.length < MIN.tabBuilders) return null;
    rows.sort((a, b) => (ascending ? a.value - b.value : b.value - a.value) || cmp(a.handle, b.handle));
    return rows.slice(0, TOP_BUILDERS_LIMIT);
  };
  const out: TopBuilders = {
    selected: tab((t) => (t.selected + t.answered >= MIN.selected ? t.selected + t.answered : null), false),
    fast: tab((t) => (t.replyMinutes.length >= MIN.fastSamples ? median(t.replyMinutes) : null), true),
    verified: tab((t) => (t.verified >= MIN.verified ? t.verified : null), false),
  };
  return out.selected || out.fast || out.verified ? out : null;
}

// ---- Top products ----
export type ProductCandidate = { id: string; slug: string; name: string; category: Category | null; builderHandle: string; builderName: string; badgeScore: number; inquiries30d: number; publishedAt: string | null };
export type TopProduct = Omit<ProductCandidate, "category">;
export type TopProductsByCategory = Partial<Record<Category, TopProduct[]>>;

/** Per category: highest badge, then 30-day inquiries, then newest `published_at`, then id. Money never enters. */
export function topProductsByCategory(candidates: ProductCandidate[]): TopProductsByCategory | null {
  const out: TopProductsByCategory = {};
  for (const c of CATEGORIES) {
    const rows = candidates
      .filter((p) => p.category === c)
      .sort((a, b) => b.badgeScore - a.badgeScore || b.inquiries30d - a.inquiries30d || cmp(b.publishedAt ?? "", a.publishedAt ?? "") || cmp(a.id, b.id))
      .slice(0, TOP_PRODUCTS_PER_CATEGORY);
    if (rows.length > 0) out[c] = rows.map(({ category: _category, ...rest }) => rest);
  }
  return Object.keys(out).length > 0 ? out : null;
}

// ---- Live ----
type LiveBase = { id: string; at: string };
export type LiveEvent =
  | (LiveBase & { kind: "product_published"; productName: string; slug: string })
  | (LiveBase & { kind: "badge_granted"; productName: string; slug: string; badge: BadgeKind })
  | (LiveBase & { kind: "builder_approved"; builderName: string; handle: string })
  | (LiveBase & { kind: "request_new"; category: Category; languages: WorkLanguage[] });
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** What the snapshot stores: no audit id (an internal ordering key only). */
export type PublicLiveEvent = DistributiveOmit<LiveEvent, "id">;

/** Public events of the last 7 calendar days (today included), newest first (ties by id), at most 20, ids dropped; under 5 events → null. */
export function liveEvents(events: LiveEvent[], now: string | Date): PublicLiveEvent[] | null {
  const from = Date.parse(windowStart(now, LIVE_DAYS));
  const to = at(now);
  const recent = events.filter((e) => at(e.at) >= from && at(e.at) <= to).sort((a, b) => cmp(b.at, a.at) || cmp(b.id, a.id));
  if (recent.length < MIN.liveEvents) return null;
  return recent.slice(0, LIVE_MAX).map(({ id: _id, ...rest }) => rest as PublicLiveEvent);
}

// ---- Snapshot ----
export type PublicStatValues = {
  count_products: number; count_builders: number; count_requests_30d: number; count_countries: number;
  trending: TrendingItem[]; request_by_category: CategoryRow[]; scarcest_category: ScarcestCategory; growth: GrowthPoint[];
  top_builders: TopBuilders; top_products: TopProductsByCategory; live: PublicLiveEvent[];
};
export type PublicSnapshot = { [K in PublicStatKey]?: { value: PublicStatValues[K]; computedAt: string } };
export type StatRow = { key: string; value: string; computedAt: string };

/** Fresh = computed at most 3 hours ago (exactly 3 hours is fresh) and at most 5 minutes ahead of `now`; an unreadable time is stale. */
export function isFresh(computedAt: string, now: string | Date): boolean {
  const t = Date.parse(computedAt);
  if (Number.isNaN(t)) return false;
  const age = at(now) - t;
  return age <= STALE_AFTER_MS && age >= -FUTURE_SKEW_MS;
}

/** The snapshot homepage blocks read: only known keys that are fresh, valid JSON and not null. Absent = hide the block. */
export function pickFresh(rows: StatRow[], now: string | Date): PublicSnapshot {
  const out: Record<string, { value: unknown; computedAt: string }> = {};
  for (const r of rows) {
    if (!(PUBLIC_STAT_KEYS as readonly string[]).includes(r.key) || !isFresh(r.computedAt, now)) continue;
    let value: unknown;
    try {
      value = JSON.parse(r.value);
    } catch {
      continue;
    }
    if (value !== null && value !== undefined) out[r.key] = { value, computedAt: r.computedAt };
  }
  return out as PublicSnapshot;
}
