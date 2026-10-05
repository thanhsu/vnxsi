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
  /** Always null until M7 (VNX-0707). */
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
