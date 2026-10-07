import { describe, expect, it } from "vitest";
import { createProductDraft } from "../../src/db/products.ts";
import { bumpProductStat, bumpProductStatStatement } from "../../src/db/stats.ts";
import { addLiveProduct, makeBuilder } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const row = (productId: string, day: string) =>
  testEnv.DB.prepare("SELECT views, demo_clicks, outbound_clicks, inquiries FROM product_daily_stats WHERE product_id = ?1 AND day = ?2").bind(productId, day).first<Record<string, number>>();

async function product(tag: string) {
  const builder = await makeBuilder(`${tag}@vnx.si`, tag, "approved");
  return addLiveProduct(builder, `${tag} product`);
}

describe("db/stats (VNX-0701a)", () => {
  it("creates the day row on the first bump and adds to it after", async () => {
    const p = await product("stats-a");
    await bumpProductStat(testEnv.DB, { productId: p.id, day: "2026-10-05", delta: { views: 1 } });
    expect(await row(p.id, "2026-10-05")).toEqual({ views: 1, demo_clicks: 0, outbound_clicks: 0, inquiries: 0 });
    await bumpProductStat(testEnv.DB, { productId: p.id, day: "2026-10-05", delta: { views: 2, demo_clicks: 1, outbound_clicks: 1 } });
    expect(await row(p.id, "2026-10-05")).toEqual({ views: 3, demo_clicks: 1, outbound_clicks: 1, inquiries: 0 });
  });

  it("keeps one row per product and day", async () => {
    const p = await product("stats-b");
    await bumpProductStat(testEnv.DB, { productId: p.id, day: "2026-10-05", delta: { views: 1 } });
    await bumpProductStat(testEnv.DB, { productId: p.id, day: "2026-10-06", delta: { views: 1 } });
    expect((await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM product_daily_stats WHERE product_id = ?1").bind(p.id).first<{ n: number }>())?.n).toBe(2);
  });

  it("is additive under concurrency", async () => {
    const p = await product("stats-c");
    await Promise.all(Array.from({ length: 5 }, () => bumpProductStat(testEnv.DB, { productId: p.id, day: "2026-10-05", delta: { views: 1 } })));
    expect((await row(p.id, "2026-10-05"))?.views).toBe(5);
  });

  it("refuses a negative, fractional or unknown delta and a bad day", async () => {
    const p = await product("stats-d");
    expect(() => bumpProductStatStatement(testEnv.DB, { productId: p.id, day: "2026-10-05", delta: { views: -1 } })).toThrow();
    expect(() => bumpProductStatStatement(testEnv.DB, { productId: p.id, day: "2026-10-05", delta: { views: 1.5 } })).toThrow();
    expect(() => bumpProductStatStatement(testEnv.DB, { productId: p.id, day: "2026-10-05", delta: { bogus: 1 } as never })).toThrow();
    expect(() => bumpProductStatStatement(testEnv.DB, { productId: p.id, day: "05/10/2026", delta: { views: 1 } })).toThrow();
  });

  it("refuses a day that is not a real date", async () => {
    const p = await product("stats-f");
    expect(() => bumpProductStatStatement(testEnv.DB, { productId: p.id, day: "2026-13-45", delta: { views: 1 } })).toThrow();
    expect(() => bumpProductStatStatement(testEnv.DB, { productId: p.id, day: "2026-02-30", delta: { views: 1 } })).toThrow();
  });

  it("the table holds counters only: no column that could identify a visitor", async () => {
    const { results } = await testEnv.DB.prepare("PRAGMA table_info(product_daily_stats)").all<{ name: string }>();
    expect(results.map((r) => r.name)).toEqual(["product_id", "day", "views", "demo_clicks", "outbound_clicks", "inquiries"]);
  });

  it("is removed with its product", async () => {
    // A bare draft: addLiveProduct creates children (pricing, media, badges) whose FKs have no cascade and would block the DELETE.
    const builder = await makeBuilder("stats-e@vnx.si", "stats-e", "approved");
    const p = await createProductDraft(testEnv.DB, { builderId: builder.userId, name: "stats-e product", now: "2026-10-05T00:00:00.000Z" });
    await bumpProductStat(testEnv.DB, { productId: p.id, day: "2026-10-05", delta: { views: 1 } });
    await testEnv.DB.prepare("DELETE FROM products WHERE id = ?1").bind(p.id).run();
    expect(await row(p.id, "2026-10-05")).toBeNull();
  });
});
