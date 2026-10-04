/** Fixed-window counter in D1 (spec §8.2). Workers Rate Limiting only supports 10s/60s periods. */
export async function hitRateLimit(
  db: D1Database,
  key: string,
  limit: number,
  windowSeconds: number,
  nowMs: number,
): Promise<{ allowed: boolean; count: number }> {
  const windowStart = Math.floor(nowMs / 1000 / windowSeconds) * windowSeconds;
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, 1)
       ON CONFLICT (key, window_start) DO UPDATE SET count = count + 1
       RETURNING count`,
    )
    .bind(key, windowStart)
    .first<{ count: number }>();
  const count = row?.count ?? 1;
  return { allowed: count <= limit, count };
}

/** Windows older than this are deleted by the daily job. The longest window in use is 1 hour; 2 days leaves room for daily limits. */
export const RATE_LIMIT_KEEP_SECONDS = 2 * 24 * 60 * 60;

/** Deletes counters (they hold raw IPs) whose window started more than 2 days before `nowMs`. Returns the rows deleted. */
export async function deleteOldRateLimitWindows(db: D1Database, nowMs: number): Promise<number> {
  const cutoff = Math.floor(nowMs / 1000) - RATE_LIMIT_KEEP_SECONDS;
  const result = await db.prepare("DELETE FROM rate_limits WHERE window_start < ?1").bind(cutoff).run();
  return result.meta.changes;
}
