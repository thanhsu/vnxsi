import { STAT_FIELDS, type StatDelta, type StatField } from "../domain/stats.ts";

/** `YYYY-MM-DD` that is a real calendar date (rejects 2026-13-45 and 2026-02-30). */
function isRealDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const d = new Date(`${day}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === day;
}

/**
 * The only writer of `product_daily_stats` (module `insights`, ADR-007 rule 10: the central event function).
 * Adds `delta` to the (product, day) row, creating it when missing, as one statement for db.batch (spec §8.11).
 * Column names come only from STAT_FIELDS, never from the caller's strings. Throws on a bad day or a delta that is
 * not a non-negative integer or names an unknown field.
 */
export function bumpProductStatStatement(db: D1Database, input: { productId: string; day: string; delta: StatDelta }): D1PreparedStatement {
  if (!isRealDay(input.day)) throw new Error(`invalid day: ${input.day}`);
  for (const [key, value] of Object.entries(input.delta)) {
    if (!(STAT_FIELDS as readonly string[]).includes(key)) throw new Error(`unknown stat field: ${key}`);
    if (!Number.isInteger(value) || (value as number) < 0) throw new Error(`invalid delta for ${key}: ${String(value)}`);
  }
  const n = (field: StatField) => input.delta[field] ?? 0;
  return db
    .prepare(
      `INSERT INTO product_daily_stats (product_id, day, views, demo_clicks, outbound_clicks, inquiries)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)
       ON CONFLICT (product_id, day) DO UPDATE SET
         views = views + excluded.views,
         demo_clicks = demo_clicks + excluded.demo_clicks,
         outbound_clicks = outbound_clicks + excluded.outbound_clicks,
         inquiries = inquiries + excluded.inquiries`,
    )
    .bind(input.productId, input.day, n("views"), n("demo_clicks"), n("outbound_clicks"), n("inquiries"));
}

export async function bumpProductStat(db: D1Database, input: { productId: string; day: string; delta: StatDelta }): Promise<void> {
  await bumpProductStatStatement(db, input).run();
}

/**
 * Counts an inquiry for its product on the UTC day it opened (spec §8.11: "inquiries tăng khi Inquiry vào open"), as a statement for
 * the SAME db.batch that opens it. It inserts nothing unless the row is a product inquiry that is `open` and whose `opened_at` is exactly
 * `openedAt`: a stale `openedAt`, a `pending_verification` row, request inquiries (no product) and a lost compare-and-set
 * (the winner stamped an earlier opened_at) count nothing. Two confirmations in the same millisecond may count twice; accepted for a statistic.
 */
export function inquiryOpenedStatement(db: D1Database, input: { inquiryId: string; openedAt: string }): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO product_daily_stats (product_id, day, views, demo_clicks, outbound_clicks, inquiries)
       SELECT product_id, substr(opened_at, 1, 10), 0, 0, 0, 1 FROM inquiries
       WHERE id = ?1 AND product_id IS NOT NULL AND status = 'open' AND opened_at = ?2
       ON CONFLICT (product_id, day) DO UPDATE SET inquiries = inquiries + excluded.inquiries`,
    )
    .bind(input.inquiryId, input.openedAt);
}
