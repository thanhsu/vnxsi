import { afterEach, describe, expect, it, vi } from "vitest";
import { purgeOldClicks, recordClick, type ClickInput } from "../../src/db/clicks.ts";
import { OUTBOUND_CLICK_PURGE_BATCH, OUTBOUND_CLICK_PURGE_MAX_BATCHES, purgeCutoff } from "../../src/domain/outbound.ts";
import { ulid } from "../../src/lib/ulid.ts";
import { testEnv } from "../helpers.ts";

const NOW = new Date("2026-10-05T01:00:00.000Z");
const shifted = (iso: string, ms: number) => new Date(Date.parse(iso) + ms).toISOString();
const click = (o: Partial<ClickInput> = {}): ClickInput => ({
  id: ulid(),
  productId: null,
  offerId: "clicks-a",
  linkKind: "offer",
  src: "tools",
  locale: "en",
  visitorHash: null,
  country: null,
  referrerHost: null,
  isBot: false,
  createdAt: NOW.toISOString(),
  ...o,
});
const rowsOf = async (offerId: string) => (await testEnv.DB.prepare("SELECT * FROM outbound_clicks WHERE offer_id = ?1 ORDER BY created_at").bind(offerId).all<Record<string, unknown>>()).results;
const names = async (sql: string) => (await testEnv.DB.prepare(sql).all<{ name: string }>()).results.map((r) => r.name);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("outbound_clicks schema (addendum §2.2, Review Focus 7)", () => {
  it("has exactly the columns of the addendum and none that could hold an IP address, an e-mail address or a user id", async () => {
    const columns = await names("PRAGMA table_info(outbound_clicks)");
    expect(columns).toEqual(["id", "product_id", "offer_id", "link_kind", "src", "locale", "visitor_hash", "country", "referrer_host", "is_bot", "created_at"]);
    for (const c of columns) expect(c).not.toMatch(/ip|mail|user|uid/i);
  });

  it("has the three indexes of the addendum plus the retention index", async () => {
    const indexes = (await names("PRAGMA index_list(outbound_clicks)")).filter((n) => n.startsWith("idx_"));
    expect(indexes.sort()).toEqual(["idx_clicks_created", "idx_clicks_offer", "idx_clicks_product", "idx_clicks_visitor"]);
  });

  it("refuses a row with neither product nor offer, an unknown kind, src or locale", async () => {
    await expect(recordClick(testEnv.DB, click({ offerId: null }))).rejects.toThrow();
    await expect(recordClick(testEnv.DB, click({ linkKind: "other" as never }))).rejects.toThrow();
    await expect(recordClick(testEnv.DB, click({ src: "elsewhere" as never }))).rejects.toThrow();
    await expect(recordClick(testEnv.DB, click({ locale: "fr" as never }))).rejects.toThrow();
  });
});

describe("recordClick", () => {
  it("stores every field; a bot is 1; a product-only row (the M7 shape) is accepted", async () => {
    const id = ulid();
    await recordClick(testEnv.DB, click({ id, offerId: "clicks-b", src: "catalog", locale: "zh-Hant", country: "VN", referrerHost: "news.example.org", isBot: true, createdAt: "2026-10-05T00:00:00.000Z" }));
    expect(await rowsOf("clicks-b")).toEqual([
      { id, product_id: null, offer_id: "clicks-b", link_kind: "offer", src: "catalog", locale: "zh-Hant", visitor_hash: null, country: "VN", referrer_host: "news.example.org", is_bot: 1, created_at: "2026-10-05T00:00:00.000Z" },
    ]);
    await recordClick(testEnv.DB, click({ productId: "p-1", offerId: null, linkKind: "demo" }));
    expect((await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM outbound_clicks WHERE product_id = 'p-1'").first<{ n: number }>())?.n).toBe(1);
  });
});

describe("purgeOldClicks (Owner 2026-10-05: 13 months)", () => {
  it("deletes rows older than the cutoff, keeps the one exactly at it and newer ones, and is idempotent", async () => {
    const cutoff = purgeCutoff(NOW);
    for (const createdAt of [shifted(cutoff, -1), cutoff, shifted(cutoff, 1), NOW.toISOString()]) await recordClick(testEnv.DB, click({ offerId: "purge-a", createdAt }));
    expect(await purgeOldClicks(testEnv.DB, NOW)).toBe(1);
    expect((await rowsOf("purge-a")).map((r) => r.created_at)).toEqual([cutoff, shifted(cutoff, 1), NOW.toISOString()]);
    expect(await purgeOldClicks(testEnv.DB, NOW)).toBe(0);
    expect(await rowsOf("purge-a")).toHaveLength(3);
  });
  const seedOld = (offerId: string, n: number) =>
    testEnv.DB.prepare(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ?2)
       INSERT INTO outbound_clicks (id, product_id, offer_id, link_kind, src, locale, is_bot, created_at)
       SELECT ?1 || i, NULL, ?1, 'offer', 'tools', 'en', 0, '2020-01-01T00:00:00.000Z' FROM n`,
    )
      .bind(offerId, n)
      .run();

  it("clears more than one batch in a single run without warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await seedOld("purge-bulk", OUTBOUND_CLICK_PURGE_BATCH + 3);
    expect(await purgeOldClicks(testEnv.DB, NOW)).toBe(OUTBOUND_CLICK_PURGE_BATCH + 3);
    expect(await purgeOldClicks(testEnv.DB, NOW)).toBe(0);
    expect(warn).not.toHaveBeenCalled();
  }, 30_000);

  it("stops after the maximum number of batches, warns with the shared capped event, and finishes on the next run", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await seedOld("purge-cap", 25);
    expect(await purgeOldClicks(testEnv.DB, NOW, 2)).toBe(2 * OUTBOUND_CLICK_PURGE_MAX_BATCHES);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(warn.mock.calls[0]?.[0]))).toEqual({ event: "jobs.daily.capped", step: "outbound_clicks", cap: 2 * OUTBOUND_CLICK_PURGE_MAX_BATCHES });
    expect(await purgeOldClicks(testEnv.DB, NOW, 2)).toBe(5);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
