import { afterEach, describe, expect, it, vi } from "vitest";
import { PUBLIC_STAT_KEYS } from "../../src/domain/public-stats.ts";
import { runHourly } from "../../src/jobs/hourly.ts";
import { writePublicStat } from "../../src/db/public-stats.ts";
import { testEnv } from "../helpers.ts";

const NOW = new Date("2026-10-05T12:05:00.000Z");
const LATER = new Date("2026-10-05T13:05:00.000Z");
const brokenOn = (fragment: string): D1Database => new Proxy(testEnv.DB, { get(db, prop) {
  if (prop === "prepare") return (sql: string) => sql.includes(fragment) ? (() => { throw new Error(`boom on ${fragment}`); })() : db.prepare(sql);
  const value = Reflect.get(db, prop) as unknown; return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(db) : value;
} }) as D1Database;
afterEach(() => vi.restoreAllMocks());

describe("hourly public-stat job", () => {
  it("writes exactly PUBLIC_STAT_KEYS, including null below thresholds", async () => {
    await testEnv.DB.prepare("DELETE FROM public_stats").run();
    const results = await runHourly(testEnv, NOW);
    expect(results.map((r) => r.step)).toEqual([...PUBLIC_STAT_KEYS]);
    expect((await testEnv.DB.prepare("SELECT key, value FROM public_stats ORDER BY key").all()).results).toHaveLength(PUBLIC_STAT_KEYS.length);
    expect((await testEnv.DB.prepare("SELECT value FROM public_stats WHERE key = 'count_products'").first<{ value: string }>())?.value).toBe("null");
  });

  it("is idempotent for values while computed_at advances", async () => {
    await runHourly(testEnv, NOW); const before = await testEnv.DB.prepare("SELECT value FROM public_stats WHERE key = 'count_products'").first<{ value: string }>();
    await runHourly(testEnv, LATER); const after = await testEnv.DB.prepare("SELECT value, computed_at FROM public_stats WHERE key = 'count_products'").first<{ value: string; computed_at: string }>();
    expect(after?.value).toBe(before?.value); expect(after?.computed_at).toBe(LATER.toISOString());
  });

  it("keeps a prior row when one query fails and continues later keys", async () => {
    const oldAt = "2026-10-05T11:05:00.000Z";
    await writePublicStat(testEnv.DB, "growth", [{ week: "2026-W40", products: 1, builders: 1 }], oldAt);
    const results = await runHourly({ ...testEnv, DB: brokenOn("first_published_at") }, NOW);
    expect(results.find((r) => r.step === "growth")).toEqual({ job: "hourly", step: "growth", error: "Error: boom on first_published_at" });
    expect(await testEnv.DB.prepare("SELECT value, computed_at FROM public_stats WHERE key = 'growth'").first()).toEqual({ value: JSON.stringify([{ week: "2026-W40", products: 1, builders: 1 }]), computed_at: oldAt });
    expect(results.find((r) => r.step === "top_builders")).toHaveProperty("value");
  });
});
