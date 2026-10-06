import { describe, expect, it } from "vitest";
import { purgeViewDedupe, recordProductView } from "../../src/db/stats.ts";
import { addLiveProduct, makeBuilder } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const H1 = "a".repeat(64);
const H2 = "b".repeat(64);
const AT = new Date("2026-10-06T10:00:00Z");

const views = async (productId: string, day: string) =>
  (await testEnv.DB.prepare("SELECT views FROM product_daily_stats WHERE product_id = ?1 AND day = ?2").bind(productId, day).first<{ views: number }>())?.views ?? 0;
const dedupe = async (productId: string) =>
  (await testEnv.DB.prepare("SELECT day, visitor_hash, product_id FROM product_view_dedupe WHERE product_id = ?1 ORDER BY day, visitor_hash").bind(productId).all<Record<string, string>>()).results;

async function product(tag: string) {
  return addLiveProduct(await makeBuilder(`${tag}@vnx.si`, tag, "approved"), `${tag} product`);
}

describe("recordProductView (VNX-0701b)", () => {
  it("counts a visitor once per product per day: first true, repeat false, views stays 1", async () => {
    const p = await product("vd-once");
    expect(await recordProductView(testEnv.DB, { productId: p.id, visitorHash: H1, now: AT })).toBe(true);
    expect(await recordProductView(testEnv.DB, { productId: p.id, visitorHash: H1, now: new Date("2026-10-06T23:59:59Z") })).toBe(false);
    expect(await views(p.id, "2026-10-06")).toBe(1);
    expect(await dedupe(p.id)).toEqual([{ day: "2026-10-06", visitor_hash: H1, product_id: p.id }]);
  });

  it("counts another visitor, another day and another product separately", async () => {
    const a = await product("vd-a");
    const b = await product("vd-b");
    expect(await recordProductView(testEnv.DB, { productId: a.id, visitorHash: H1, now: AT })).toBe(true);
    expect(await recordProductView(testEnv.DB, { productId: a.id, visitorHash: H2, now: AT })).toBe(true);
    expect(await recordProductView(testEnv.DB, { productId: a.id, visitorHash: H1, now: new Date("2026-10-07T00:00:00Z") })).toBe(true);
    expect(await recordProductView(testEnv.DB, { productId: b.id, visitorHash: H1, now: AT })).toBe(true);
    expect(await views(a.id, "2026-10-06")).toBe(2);
    expect(await views(a.id, "2026-10-07")).toBe(1);
    expect(await views(b.id, "2026-10-06")).toBe(1);
  });

  it("never double counts under concurrency", async () => {
    const p = await product("vd-race");
    const results = await Promise.all(Array.from({ length: 5 }, () => recordProductView(testEnv.DB, { productId: p.id, visitorHash: H1, now: AT })));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await views(p.id, "2026-10-06")).toBe(1);
    expect(await dedupe(p.id)).toHaveLength(1);
  });

  it("refuses a hash that is not 64 lower-case hex characters and writes nothing", async () => {
    const p = await product("vd-bad");
    for (const bad of ["", "x", "A".repeat(64), "a".repeat(63), "a".repeat(65), "visitor@example.com", "203.0.113.9"]) {
      await expect(recordProductView(testEnv.DB, { productId: p.id, visitorHash: bad, now: AT })).rejects.toThrow();
    }
    expect(await views(p.id, "2026-10-06")).toBe(0);
    expect(await dedupe(p.id)).toHaveLength(0);
  });
});

describe("product_view_dedupe schema (Review Focus 2)", () => {
  it("has exactly day, visitor_hash, product_id: no IP, e-mail or user id", async () => {
    const cols = (await testEnv.DB.prepare("PRAGMA table_info(product_view_dedupe)").all<{ name: string }>()).results.map((r) => r.name);
    expect(cols).toEqual(["day", "visitor_hash", "product_id"]);
  });

  it("cascades with the product and the table itself rejects a non-hash value", async () => {
    const fks = (await testEnv.DB.prepare("PRAGMA foreign_key_list(product_view_dedupe)").all<{ table: string; on_delete: string }>()).results;
    expect(fks).toEqual([expect.objectContaining({ table: "products", on_delete: "CASCADE" })]);
    const p = await product("vd-check");
    await expect(testEnv.DB.prepare("INSERT INTO product_view_dedupe (day, visitor_hash, product_id) VALUES ('2026-10-06', 'someone@example.com', ?1)").bind(p.id).run()).rejects.toThrow();
    await expect(testEnv.DB.prepare("INSERT INTO product_view_dedupe (day, visitor_hash, product_id) VALUES ('yesterday', ?1, ?2)").bind(H1, p.id).run()).rejects.toThrow();
  });
});

describe("purgeViewDedupe (VNX-0701b)", () => {
  it("deletes every row of an earlier UTC day, keeps today's, and a rerun changes nothing", async () => {
    const p = await product("vd-purge");
    for (const day of ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]) await recordProductView(testEnv.DB, { productId: p.id, visitorHash: H1, now: new Date(`${day}T12:00:00Z`) });
    const now = new Date("2026-10-04T01:00:00Z"); // the one purge clock of the suite: cutoff day 2026-10-04
    expect(await purgeViewDedupe(testEnv.DB, now)).toEqual(expect.any(Number)); // D1 is shared: rely on the per-product rows below, not the count
    expect((await dedupe(p.id)).map((r) => r.day)).toEqual(["2026-10-04"]);
    await purgeViewDedupe(testEnv.DB, now);
    expect((await dedupe(p.id)).map((r) => r.day)).toEqual(["2026-10-04"]);
    expect(await views(p.id, "2026-10-01")).toBe(1); // the counters are never purged
  });
});
