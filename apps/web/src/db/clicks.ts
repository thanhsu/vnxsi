import { OUTBOUND_CLICK_PURGE_BATCH, OUTBOUND_CLICK_PURGE_MAX_BATCHES, purgeCutoff, type OutboundSrc } from "../domain/outbound.ts";
import type { Locale } from "../i18n/locales.ts";

/**
 * The only writer of `outbound_clicks` (module `monetization`, addendum §2.2). A click row never holds an IP address, an e-mail
 * address or a user id; this type has no field for them, and the table has no column for them.
 */
export type ClickInput = {
  /** ULID. For a tracked redirect it is also the `click_id` that went to the partner. */
  id: string;
  productId: string | null;
  offerId: string | null;
  linkKind: "demo" | "site" | "offer";
  src: OutboundSrc;
  locale: Locale;
  /** Null unless a visitor cookie, a usable salt, no GPC and no bot (VNX-0707b); never set for offers. */
  visitorHash: string | null;
  country: string | null;
  referrerHost: string | null;
  isBot: boolean;
  createdAt: string;
};

export async function recordClick(db: D1Database, c: ClickInput): Promise<void> {
  await db
    .prepare(
      `INSERT INTO outbound_clicks (id, product_id, offer_id, link_kind, src, locale, visitor_hash, country, referrer_host, is_bot, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
    )
    .bind(c.id, c.productId, c.offerId, c.linkKind, c.src, c.locale, c.visitorHash, c.country, c.referrerHost, c.isBot ? 1 : 0, c.createdAt)
    .run();
}

/**
 * "This visitor already clicked this product link today (UTC)": the de-duplication read behind product_daily_stats (routes/go.ts joins
 * it to db/stats.ts; this file owns the table). Run it BEFORE recording the new click. The hash must be non-null. It uses all four columns
 * of idx_clicks_visitor. Two simultaneous clicks of one visitor may both see "no": routes/go.ts collapses those within one isolate.
 */

/** The dedupe query, exported so the index test can EXPLAIN exactly this text. */
export const CLICK_TODAY_SQL = "SELECT 1 AS hit FROM outbound_clicks WHERE visitor_hash = ?1 AND product_id = ?2 AND link_kind = ?3 AND created_at >= ?4 AND created_at < ?5 LIMIT 1";

export async function hasClickToday(db: D1Database, input: { visitorHash: string; productId: string; linkKind: "demo" | "site"; day: string }): Promise<boolean> {
  const next = new Date(Date.parse(`${input.day}T00:00:00.000Z`) + 86_400_000).toISOString().slice(0, 10);
  const row = await db
    .prepare(CLICK_TODAY_SQL)
    .bind(input.visitorHash, input.productId, input.linkKind, input.day, next)
    .first<{ hit: number }>();
  return row !== null;
}

/**
 * Daily retention (Owner 2026-10-05: 13 months). Deletes rows older than the cutoff, oldest first, in batches of `batch`, at most
 * OUTBOUND_CLICK_PURGE_MAX_BATCHES batches per run; what is left waits for the next run (and is logged like the other capped steps).
 * Running it again changes nothing once the table is clean. Returns the number of rows deleted.
 */
export async function purgeOldClicks(db: D1Database, now: Date, batch: number = OUTBOUND_CLICK_PURGE_BATCH): Promise<number> {
  const cutoff = purgeCutoff(now);
  let total = 0;
  for (let i = 0; i < OUTBOUND_CLICK_PURGE_MAX_BATCHES; i++) {
    const result = await db
      .prepare("DELETE FROM outbound_clicks WHERE id IN (SELECT id FROM outbound_clicks WHERE created_at < ?1 ORDER BY created_at LIMIT ?2)")
      .bind(cutoff, batch)
      .run();
    total += result.meta.changes;
    if (result.meta.changes < batch) return total;
  }
  console.warn(JSON.stringify({ event: "jobs.daily.capped", step: "outbound_clicks", cap: batch * OUTBOUND_CLICK_PURGE_MAX_BATCHES }));
  return total;
}
