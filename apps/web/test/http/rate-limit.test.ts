import { describe, expect, it } from "vitest";
import { hitRateLimit } from "../../src/http/rate-limit.ts";
import { testEnv } from "../helpers.ts";

describe("hitRateLimit", () => {
  it("allows up to the limit inside a window, then blocks", async () => {
    const t0 = Date.parse("2026-10-03T09:00:10Z");
    const results = [];
    for (let i = 0; i < 6; i++) results.push(await hitRateLimit(testEnv.DB, "k:1", 5, 3600, t0 + i));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, true, true, false]);
    expect(results[5]?.count).toBe(6);
  });

  it("starts a fresh window after it ends", async () => {
    const t0 = Date.parse("2026-10-03T09:00:10Z");
    for (let i = 0; i < 5; i++) await hitRateLimit(testEnv.DB, "k:2", 5, 3600, t0);
    const next = await hitRateLimit(testEnv.DB, "k:2", 5, 3600, Date.parse("2026-10-03T10:00:01Z"));
    expect(next).toEqual({ allowed: true, count: 1 });
  });

  it("keeps keys independent", async () => {
    const t0 = Date.now();
    for (let i = 0; i < 5; i++) await hitRateLimit(testEnv.DB, "k:a", 5, 3600, t0);
    expect((await hitRateLimit(testEnv.DB, "k:b", 5, 3600, t0)).allowed).toBe(true);
  });
});
