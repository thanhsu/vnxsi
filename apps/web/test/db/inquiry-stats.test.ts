import { describe, expect, it } from "vitest";
import { setInquiryStatus } from "../../src/db/inquiries.ts";
import { inquiryOpenedStatement } from "../../src/db/stats.ts";
import { makeInquiry } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const NOW = "2026-10-05T10:00:00.000Z";
const inquiriesOn = async (productId: string, day: string) =>
  (await testEnv.DB.prepare("SELECT inquiries FROM product_daily_stats WHERE product_id = ?1 AND day = ?2").bind(productId, day).first<{ inquiries: number }>())?.inquiries ?? 0;

describe("inquiries are counted when they open (spec §8.11)", () => {
  it("counts a signed-in inquiry for its product on the UTC day it opened", async () => {
    const { product } = await makeInquiry({ tag: "istat-open", status: "open", now: NOW });
    expect(await inquiriesOn(product!.id, "2026-10-05")).toBe(1);
  });

  it("does not count an unconfirmed (pending_verification) inquiry", async () => {
    const { product } = await makeInquiry({ tag: "istat-pending", status: "pending_verification", now: NOW });
    expect(await inquiriesOn(product!.id, "2026-10-05")).toBe(0);
  });

  it("does not count an inquiry that has no product (a request inquiry)", async () => {
    const sum = async () => (await testEnv.DB.prepare("SELECT COALESCE(SUM(inquiries), 0) AS n FROM product_daily_stats").first<{ n: number }>())?.n ?? 0;
    const before = await sum();
    await makeInquiry({ tag: "istat-noprod", status: "open", withProduct: false, type: "hire", now: NOW });
    expect(await sum()).toBe(before);
  });

  it("a later status change does not count again and does not move the count to another day", async () => {
    const { inquiry, product } = await makeInquiry({ tag: "istat-later", status: "open", now: NOW });
    await setInquiryStatus(testEnv.DB, { id: inquiry.id, from: "open", to: "answered", now: "2026-10-06T10:00:00.000Z" });
    expect(await inquiriesOn(product!.id, "2026-10-05")).toBe(1);
    expect(await inquiriesOn(product!.id, "2026-10-06")).toBe(0);
  });

  it("inquiryOpenedStatement alone inserts nothing for a stale openedAt or for a pending_verification row", async () => {
    const open = await makeInquiry({ tag: "istat-stale", status: "open", now: NOW });
    await inquiryOpenedStatement(testEnv.DB, { inquiryId: open.inquiry.id, openedAt: "2026-10-04T10:00:00.000Z" }).run();
    expect(await inquiriesOn(open.product!.id, "2026-10-04")).toBe(0);
    expect(await inquiriesOn(open.product!.id, "2026-10-05")).toBe(1);

    const pending = await makeInquiry({ tag: "istat-pend2", status: "pending_verification", now: NOW });
    await inquiryOpenedStatement(testEnv.DB, { inquiryId: pending.inquiry.id, openedAt: NOW }).run();
    expect(await inquiriesOn(pending.product!.id, "2026-10-05")).toBe(0);
  });

  it("a second inquiry opened for the same product on the same UTC day increments the existing row (ON CONFLICT)", async () => {
    const first = await makeInquiry({ tag: "istat-conf-1", status: "open", now: NOW });
    expect(await inquiriesOn(first.product!.id, "2026-10-05")).toBe(1);
    const other = await makeInquiry({ tag: "istat-conf-2", status: "open", now: NOW });
    await testEnv.DB.prepare("UPDATE inquiries SET product_id = ?1 WHERE id = ?2").bind(first.product!.id, other.inquiry.id).run();
    await inquiryOpenedStatement(testEnv.DB, { inquiryId: other.inquiry.id, openedAt: NOW }).run();
    expect(await inquiriesOn(first.product!.id, "2026-10-05")).toBe(2);
    const rows = await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM product_daily_stats WHERE product_id = ?1 AND day = ?2").bind(first.product!.id, "2026-10-05").first<{ n: number }>();
    expect(rows?.n).toBe(1);
  });
});
