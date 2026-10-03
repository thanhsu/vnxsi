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
