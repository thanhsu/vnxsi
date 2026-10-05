import { WORK_LANGUAGES, type WorkLanguage } from "../domain/builder.ts";
import { CATEGORIES, type BadgeKind, type Category } from "../domain/product.ts";
import {
  BUILDER_DAYS, LIVE_DAYS, PUBLIC_STAT_KEYS, REQUEST_DAYS, SPARK_DAYS, lastDays, pickFresh, windowStart,
  type BuilderTally, type CategoryCounts, type LiveEvent, type ProductCandidate, type PublicSnapshot, type PublicStatKey, type PublicStatValues, type TrendingCandidate,
} from "../domain/public-stats.ts";
import { BADGE_SCORE_SQL } from "./catalog.ts";
import { PUBLIC_PRODUCT } from "./products.ts";

/**
 * The only writer of `public_stats` and the read side of the hourly job (module `insights`, ADR-007 rule 10).
 * Ranking code: it reads `product_daily_stats`, `inquiries` and catalogue tables, never a table of money (ADR-004, ADR-007 rule 2).
 */

const PUBLIC_JOIN = "JOIN builders b ON b.user_id = p.builder_id JOIN users u ON u.id = p.builder_id";
const APPROVED_BUILDER = "b.status = 'approved' AND u.status = 'active'";
/** An inquiry that really opened and was not removed as spam (E2). */
const COUNTED_INQUIRY = "i.opened_at IS NOT NULL AND i.status <> 'removed'";

/** Stores one number (the JSON null when under its threshold) with its computation time. One row per key. */
export async function writePublicStat<K extends PublicStatKey>(db: D1Database, key: K, value: PublicStatValues[K] | null, now: string): Promise<void> {
  if (!(PUBLIC_STAT_KEYS as readonly string[]).includes(key)) throw new Error(`unknown public stat key: ${key}`);
  if (Number.isNaN(Date.parse(now))) throw new Error(`invalid time: ${now}`);
  await db
    .prepare("INSERT INTO public_stats (key, value, computed_at) VALUES (?1, ?2, ?3) ON CONFLICT (key) DO UPDATE SET value = excluded.value, computed_at = excluded.computed_at")
    .bind(key, JSON.stringify(value), now)
    .run();
}

/** All fresh, non-null numbers in ONE query. A key older than 3 hours or holding null is absent: the block hides. */
export async function readPublicStats(db: D1Database, now: string | Date): Promise<PublicSnapshot> {
  const { results } = await db.prepare("SELECT key, value, computed_at FROM public_stats").all<{ key: string; value: string; computed_at: string }>();
  return pickFresh(results.map((r) => ({ key: r.key, value: r.value, computedAt: r.computed_at })), now);
}

export async function loadCounts(db: D1Database, now: string): Promise<{ products: number; builders: number; requests30d: number; countries: number }> {
  const row = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM products p ${PUBLIC_JOIN} WHERE ${PUBLIC_PRODUCT}) AS products,
         (SELECT COUNT(*) FROM builders b JOIN users u ON u.id = b.user_id WHERE ${APPROVED_BUILDER}) AS builders,
         (SELECT COUNT(*) FROM requests WHERE submitted_at IS NOT NULL AND submitted_at >= ?1 AND status <> 'removed') AS requests30d,
         (SELECT COUNT(DISTINCT b.country) FROM builders b JOIN users u ON u.id = b.user_id WHERE ${APPROVED_BUILDER}) AS countries`,
    )
    .bind(windowStart(now, REQUEST_DAYS))
    .first<{ products: number; builders: number; requests30d: number; countries: number }>();
  return row ?? { products: 0, builders: 0, requests30d: 0, countries: 0 };
}

export async function loadCategoryCounts(db: D1Database, now: string): Promise<{ requests: CategoryCounts; products: CategoryCounts }> {
  const [requests, products] = await db.batch<{ category: Category; n: number }>([
    db.prepare("SELECT category, COUNT(*) AS n FROM requests WHERE submitted_at IS NOT NULL AND submitted_at >= ?1 AND status <> 'removed' GROUP BY category").bind(windowStart(now, REQUEST_DAYS)),
    db.prepare(`SELECT p.category AS category, COUNT(*) AS n FROM products p ${PUBLIC_JOIN} WHERE ${PUBLIC_PRODUCT} AND p.category IS NOT NULL GROUP BY p.category`),
  ]);
  const toCounts = (rows: { category: Category; n: number }[]): CategoryCounts => Object.fromEntries(rows.filter((r) => (CATEGORIES as readonly string[]).includes(r.category)).map((r) => [r.category, r.n]));
  return { requests: toCounts(requests!.results), products: toCounts(products!.results) };
}

/** Product first publications and builder approvals per UTC day (public ones only), for the weekly growth chart. */
export async function loadGrowthDays(db: D1Database): Promise<{ products: Record<string, number>; builders: Record<string, number> }> {
  const [products, builders] = await db.batch<{ day: string; n: number }>([
    db.prepare(`SELECT substr(p.first_published_at, 1, 10) AS day, COUNT(*) AS n FROM products p ${PUBLIC_JOIN} WHERE ${PUBLIC_PRODUCT} AND p.first_published_at IS NOT NULL GROUP BY day`),
    db.prepare(`SELECT substr(b.approved_at, 1, 10) AS day, COUNT(*) AS n FROM builders b JOIN users u ON u.id = b.user_id WHERE ${APPROVED_BUILDER} AND b.approved_at IS NOT NULL GROUP BY day`),
  ]);
  const toMap = (rows: { day: string; n: number }[]) => Object.fromEntries(rows.map((r) => [r.day, r.n]));
  return { products: toMap(products!.results), builders: toMap(builders!.results) };
}

/** Inquiries that opened on or after `from` and were not removed, per product and UTC day (E2). */
async function inquiriesByProductDay(db: D1Database, from: string): Promise<{ product_id: string; day: string; n: number }[]> {
  const { results } = await db
    .prepare(`SELECT i.product_id AS product_id, substr(i.opened_at, 1, 10) AS day, COUNT(*) AS n FROM inquiries i WHERE i.product_id IS NOT NULL AND ${COUNTED_INQUIRY} AND i.opened_at >= ?1 GROUP BY i.product_id, day`)
    .bind(`${from}T00:00:00.000Z`)
    .all<{ product_id: string; day: string; n: number }>();
  return results;
}

/** Every public product with its last 14 days of views, demo clicks and (non-removed) inquiries. */
export async function loadTrendingCandidates(db: D1Database, now: string): Promise<TrendingCandidate[]> {
  const days = lastDays(now, SPARK_DAYS);
  const from = days[0] as string;
  const [products, stats] = await db.batch<Record<string, string | number | null>>([
    db.prepare(`SELECT p.id, p.slug, p.name, p.tagline, p.category, b.handle AS builder_handle, b.name AS builder_name FROM products p ${PUBLIC_JOIN} WHERE ${PUBLIC_PRODUCT}`),
    db.prepare("SELECT product_id, day, views, demo_clicks FROM product_daily_stats WHERE day >= ?1").bind(from),
  ]);
  const byId = new Map<string, TrendingCandidate>();
  for (const r of products!.results) {
    byId.set(r.id as string, { productId: r.id as string, slug: r.slug as string, name: r.name as string, tagline: r.tagline as string, category: (r.category as Category | null) ?? null, builderHandle: r.builder_handle as string, builderName: r.builder_name as string, daily: {} });
  }
  for (const r of stats!.results) {
    const c = byId.get(r.product_id as string);
    if (c) c.daily[r.day as string] = { views: r.views as number, demoClicks: r.demo_clicks as number };
  }
  for (const r of await inquiriesByProductDay(db, from)) {
    const c = byId.get(r.product_id);
    if (c) c.daily[r.day] = { ...c.daily[r.day], inquiries: r.n };
  }
  return [...byId.values()];
}

/** Every public product with its active top badge score, 30-day inquiries (not removed) and `published_at`. */
export async function loadProductCandidates(db: D1Database, now: string): Promise<ProductCandidate[]> {
  const { results } = await db
    .prepare(`SELECT p.id, p.slug, p.name, p.category, p.published_at, b.handle AS builder_handle, b.name AS builder_name, ${BADGE_SCORE_SQL} AS badge_score FROM products p ${PUBLIC_JOIN} WHERE ${PUBLIC_PRODUCT}`)
    .all<{ id: string; slug: string; name: string; category: Category | null; published_at: string | null; builder_handle: string; builder_name: string; badge_score: number }>();
  const inquiries = new Map<string, number>();
  for (const r of await inquiriesByProductDay(db, lastDays(now, REQUEST_DAYS)[0] as string)) inquiries.set(r.product_id, (inquiries.get(r.product_id) ?? 0) + r.n);
  return results.map((r) => ({ id: r.id, slug: r.slug, name: r.name, category: r.category, builderHandle: r.builder_handle, builderName: r.builder_name, badgeScore: r.badge_score, inquiries30d: inquiries.get(r.id) ?? 0, publishedAt: r.published_at }));
}

const minutes = (from: string, to: string): number | null => {
  const ms = Date.parse(to) - Date.parse(from);
  return Number.isNaN(ms) || ms < 0 ? null : Math.floor(ms / 60_000);
};

/**
 * One tally per public builder: selected invitations, answered inquiries (not removed, with a builder message of kind `message`, whatever the status is now),
 * first-reply minutes (90 calendar days, anchored on the start of the record) and verified products. Invitations of removed requests are left out.
 */
export async function loadBuilderTallies(db: D1Database, now: string): Promise<BuilderTally[]> {
  const from = windowStart(now, BUILDER_DAYS);
  const [builders, invites, inquiries] = await db.batch<Record<string, string | number | null>>([
    db.prepare(
      `SELECT b.user_id, b.handle, b.name,
         (SELECT COUNT(*) FROM products p WHERE p.builder_id = b.user_id AND p.status = 'published'
            AND EXISTS (SELECT 1 FROM product_verifications v WHERE v.product_id = p.id AND v.kind IN ('demo_verified', 'in_production') AND v.revoked_at IS NULL)) AS verified
       FROM builders b JOIN users u ON u.id = b.user_id WHERE ${APPROVED_BUILDER}`,
    ),
    db.prepare("SELECT ri.builder_id, ri.status, ri.invited_at, ri.responded_at FROM request_invites ri JOIN requests r ON r.id = ri.request_id WHERE r.status <> 'removed' AND ri.invited_at >= ?1").bind(from),
    db.prepare(
      `SELECT i.builder_id, i.opened_at,
         EXISTS (SELECT 1 FROM inquiry_messages m WHERE m.inquiry_id = i.id AND m.sender_user_id = i.builder_id AND m.kind = 'message') AS answered,
         (SELECT MIN(m.created_at) FROM inquiry_messages m WHERE m.inquiry_id = i.id AND m.sender_user_id = i.builder_id) AS first_reply
       FROM inquiries i WHERE ${COUNTED_INQUIRY} AND i.opened_at >= ?1`,
    ).bind(from),
  ]);
  const tallies = new Map<string, BuilderTally>();
  for (const r of builders!.results) tallies.set(r.user_id as string, { userId: r.user_id as string, handle: r.handle as string, name: r.name as string, selected: 0, answered: 0, replyMinutes: [], verified: r.verified as number });
  for (const r of invites!.results) {
    const t = tallies.get(r.builder_id as string);
    if (!t) continue;
    if (r.status === "selected") t.selected++;
    const m = r.responded_at ? minutes(r.invited_at as string, r.responded_at as string) : null;
    if (m !== null) t.replyMinutes.push(m);
  }
  for (const r of inquiries!.results) {
    const t = tallies.get(r.builder_id as string);
    if (!t) continue;
    if (r.answered === 1) t.answered++;
    const m = r.first_reply ? minutes(r.opened_at as string, r.first_reply as string) : null;
    if (m !== null) t.replyMinutes.push(m);
  }
  return [...tallies.values()];
}

/**
 * Public events of the last 7 calendar days from `audit_log` (spec §8.11). Selects only names, slugs, a badge kind, a category, languages and, for `builder.apply`, only `status`:
 * never the rest of `audit_log.data` (evidence, notes), a request's title or text, or any client. Only things that are public NOW.
 */
export async function loadLiveEvents(db: D1Database, now: string): Promise<LiveEvent[]> {
  const from = windowStart(now, LIVE_DAYS);
  const [published, badges, approved, requests] = await db.batch<Record<string, string | null>>([
    db.prepare(`SELECT a.id, a.created_at AS at, p.name AS product_name, p.slug FROM audit_log a JOIN products p ON p.id = a.entity_id ${PUBLIC_JOIN} WHERE a.action = 'product.approve' AND a.entity = 'product' AND a.created_at >= ?1 AND ${PUBLIC_PRODUCT}`).bind(from),
    db.prepare(
      `SELECT a.id, a.created_at AS at, p.name AS product_name, p.slug, json_extract(a.data, '$.kind') AS kind
       FROM audit_log a JOIN products p ON p.id = a.entity_id ${PUBLIC_JOIN}
       WHERE a.action = 'badge.grant' AND a.entity = 'product' AND a.created_at >= ?1 AND ${PUBLIC_PRODUCT}
         AND json_extract(a.data, '$.kind') IN ('demo_verified', 'in_production')
         AND EXISTS (SELECT 1 FROM product_verifications v WHERE v.product_id = p.id AND v.kind = json_extract(a.data, '$.kind') AND v.verified_at = a.created_at AND v.revoked_at IS NULL)`,
    ).bind(from),
    db.prepare(`SELECT a.id, a.created_at AS at, b.name AS builder_name, b.handle FROM audit_log a JOIN builders b ON b.user_id = a.entity_id JOIN users u ON u.id = b.user_id WHERE (a.action = 'builder.approve' OR (a.action = 'builder.apply' AND json_extract(a.data, '$.status') = 'approved')) AND a.entity = 'builder' AND a.created_at >= ?1 AND ${APPROVED_BUILDER}`).bind(from),
    db.prepare("SELECT a.id, a.created_at AS at, json_extract(a.data, '$.category') AS category, json_extract(a.data, '$.languages') AS languages FROM audit_log a JOIN requests r ON r.id = a.entity_id WHERE a.action IN ('request.verify', 'request.submit') AND a.entity = 'request' AND a.created_at >= ?1 AND r.status <> 'removed'").bind(from),
  ]);
  const events: LiveEvent[] = [];
  for (const r of published!.results) events.push({ id: r.id as string, at: r.at as string, kind: "product_published", productName: r.product_name as string, slug: r.slug as string });
  for (const r of badges!.results) events.push({ id: r.id as string, at: r.at as string, kind: "badge_granted", productName: r.product_name as string, slug: r.slug as string, badge: r.kind as BadgeKind });
  for (const r of approved!.results) events.push({ id: r.id as string, at: r.at as string, kind: "builder_approved", builderName: r.builder_name as string, handle: r.handle as string });
  for (const r of requests!.results) {
    if (!(CATEGORIES as readonly string[]).includes(r.category as string)) continue;
    let languages: WorkLanguage[] = [];
    try {
      const parsed: unknown = JSON.parse((r.languages as string | null) ?? "[]");
      if (Array.isArray(parsed)) languages = parsed.filter((l): l is WorkLanguage => (WORK_LANGUAGES as readonly string[]).includes(l as string));
    } catch {
      // unreadable languages: show the event without them
    }
    events.push({ id: r.id as string, at: r.at as string, kind: "request_new", category: r.category as Category, languages });
  }
  return events;
}
