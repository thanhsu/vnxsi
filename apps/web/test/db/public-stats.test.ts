import { describe, expect, it } from "vitest";
import {
  loadBuilderTallies, loadCategoryCounts, loadCounts, loadGrowthDays, loadLiveEvents, loadProductCandidates, loadTrendingCandidates, readPublicStats, writePublicStat,
} from "../../src/db/public-stats.ts";
import { bumpProductStat } from "../../src/db/stats.ts";
import { addDays, STALE_AFTER_MS } from "../../src/domain/public-stats.ts";
import { addLiveProduct, ensureUser, inviteBuilders, makeBuilder, makeInquiry, makeRequest } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const NOW = "2026-10-05T12:05:00.000Z";
const TODAY = "2026-10-05";
const DB = testEnv.DB;
const daysBefore = (now: string, n: number) => new Date(Date.parse(now) - n * 86_400_000).toISOString();
const run = (sql: string, ...args: (string | number | null)[]) => DB.prepare(sql).bind(...args).run();

describe("snapshot storage", () => {
  it("round-trips a value with its computed_at and upserts one row per key", async () => {
    await writePublicStat(DB, "count_products", 12, "2026-10-05T11:05:00.000Z");
    await writePublicStat(DB, "count_products", 14, NOW);
    const snap = await readPublicStats(DB, NOW);
    expect(snap.count_products).toEqual({ value: 14, computedAt: NOW });
    expect((await DB.prepare("SELECT COUNT(*) AS n FROM public_stats WHERE key = 'count_products'").first<{ n: number }>())?.n).toBe(1);
  });

  it("is idempotent: writing the same value at the same time changes nothing", async () => {
    await writePublicStat(DB, "count_builders", 11, NOW);
    await writePublicStat(DB, "count_builders", 11, NOW);
    expect((await readPublicStats(DB, NOW)).count_builders).toEqual({ value: 11, computedAt: NOW });
  });

  it("a block is stale after 3 hours: exactly 3 hours is read, 1 ms more is not", async () => {
    await writePublicStat(DB, "count_countries", 4, new Date(Date.parse(NOW) - STALE_AFTER_MS).toISOString());
    expect((await readPublicStats(DB, NOW)).count_countries?.value).toBe(4);
    await writePublicStat(DB, "count_countries", 4, new Date(Date.parse(NOW) - STALE_AFTER_MS - 1).toISOString());
    expect((await readPublicStats(DB, NOW)).count_countries).toBeUndefined();
  });

  it("a null value (under threshold) is not returned, but the row exists", async () => {
    await writePublicStat(DB, "count_requests_30d", null, NOW);
    expect((await readPublicStats(DB, NOW)).count_requests_30d).toBeUndefined();
    expect((await DB.prepare("SELECT value FROM public_stats WHERE key = 'count_requests_30d'").first<{ value: string }>())?.value).toBe("null");
  });

  it("rejects an unknown key and a bad time; the table refuses non-JSON", async () => {
    await expect(writePublicStat(DB, "nope" as never, 1 as never, NOW)).rejects.toThrow();
    await expect(writePublicStat(DB, "count_products", 1, "yesterday")).rejects.toThrow();
    await expect(run("INSERT INTO public_stats (key, value, computed_at) VALUES ('k', '{oops', ?1)", NOW)).rejects.toThrow();
  });

  it("reads with one query", async () => {
    const prepared: string[] = [];
    const spy = { prepare: (sql: string) => (prepared.push(sql), DB.prepare(sql)), batch: (s: D1PreparedStatement[]) => DB.batch(s) } as unknown as D1Database;
    await readPublicStats(spy, NOW);
    expect(prepared).toHaveLength(1);
  });
});

describe("counts", () => {
  it("count only public products, approved active builders, 30-day submitted requests that are not removed, distinct countries", async () => {
    const before = await loadCounts(DB, NOW);
    const ok = await makeBuilder("cnt-ok@vnx.si", "cnt-ok", "approved", { country: "NZ" });
    await addLiveProduct(ok, "Cnt live");
    const pending = await makeBuilder("cnt-pend@vnx.si", "cnt-pend", "pending", { country: "IS" });
    await addLiveProduct(pending, "Cnt pending builder"); // published, builder not approved
    await makeBuilder("cnt-ok2@vnx.si", "cnt-ok2", "approved", { country: "NZ" }); // same country again
    const { request } = await makeRequest({ tag: "cnt-r-ok", now: daysBefore(NOW, 29) });
    await makeRequest({ tag: "cnt-r-old", now: daysBefore(NOW, 31) });
    await makeRequest({ tag: "cnt-r-pend", status: "pending_verification", now: daysBefore(NOW, 1) });
    const { request: gone } = await makeRequest({ tag: "cnt-r-gone", now: daysBefore(NOW, 1) });
    await run("UPDATE requests SET status = 'removed' WHERE id = ?1", gone.id);
    const after = await loadCounts(DB, NOW);
    expect(request.id).toBeTruthy();
    expect(after.products - before.products).toBe(1);
    expect(after.builders - before.builders).toBe(2);
    expect(after.requests30d - before.requests30d).toBe(1);
    expect(after.countries - before.countries).toBe(1);
  });
});

describe("trending inputs (E2: removed inquiries do not count)", () => {
  it("takes views and demo clicks from product_daily_stats and inquiries from the inquiries table without removed ones", async () => {
    const a = await makeInquiry({ tag: "tr-a", status: "open", now: "2026-10-05T10:00:00.000Z" });
    const b = await makeInquiry({ tag: "tr-b", status: "open", now: "2026-10-05T10:00:00.000Z" });
    await run("UPDATE inquiries SET status = 'removed' WHERE id = ?1", b.inquiry.id); // spam, removed by an admin
    for (const p of [a.product!, b.product!]) await bumpProductStat(DB, { productId: p.id, day: TODAY, delta: { views: 4, demo_clicks: 3 } });
    const list = await loadTrendingCandidates(DB, NOW);
    const get = (id: string) => list.find((c) => c.productId === id)!;
    expect(get(a.product!.id).daily[TODAY]).toEqual({ views: 4, demoClicks: 3, inquiries: 1 });
    expect(get(b.product!.id).daily[TODAY]).toEqual({ views: 4, demoClicks: 3 }); // the removed inquiry adds nothing
    // the raw record is untouched: the counter still says 1 for both
    expect((await DB.prepare("SELECT inquiries FROM product_daily_stats WHERE product_id = ?1").bind(b.product!.id).first<{ inquiries: number }>())?.inquiries).toBe(1);
  });

  it("lists only public products and nothing outside the 14 days", async () => {
    const draft = await makeBuilder("tr-d@vnx.si", "tr-d", "pending");
    const live = await addLiveProduct(await makeBuilder("tr-l@vnx.si", "tr-l", "approved"), "Tr live");
    await bumpProductStat(DB, { productId: live.id, day: addDays(TODAY, -14), delta: { views: 99 } }); // day 15: outside
    await bumpProductStat(DB, { productId: live.id, day: addDays(TODAY, -13), delta: { views: 1 } });
    const hidden = await addLiveProduct(draft, "Tr hidden");
    const list = await loadTrendingCandidates(DB, NOW);
    expect(list.find((c) => c.productId === hidden.id)).toBeUndefined();
    const mine = list.find((c) => c.productId === live.id)!;
    expect(Object.keys(mine.daily)).toEqual([addDays(TODAY, -13)]);
  });

  it("does not read outbound_clicks (a money table) at all", async () => {
    const seen: string[] = [];
    const spy = { prepare: (sql: string) => (seen.push(sql), DB.prepare(sql)), batch: (s: D1PreparedStatement[]) => DB.batch(s) } as unknown as D1Database;
    await loadTrendingCandidates(spy, NOW);
    await loadProductCandidates(spy, NOW);
    expect(seen.length).toBeGreaterThan(0);
    for (const sql of seen) expect(sql).not.toMatch(/outbound_clicks|offers|merchants|partner_programs/i);
  });
});

describe("category and growth inputs", () => {
  it("counts 30-day requests by category (not removed, not pending) and public products by category", async () => {
    const before = await loadCategoryCounts(DB, NOW);
    await makeRequest({ tag: "cat-1", category: "hr", now: daysBefore(NOW, 2) });
    await makeRequest({ tag: "cat-2", category: "hr", now: daysBefore(NOW, 2) });
    await makeRequest({ tag: "cat-3", category: "hr", status: "pending_verification", now: daysBefore(NOW, 2) });
    await addLiveProduct(await makeBuilder("cat-b@vnx.si", "cat-b", "approved"), "Cat hr", { fields: { category: "hr" } });
    const after = await loadCategoryCounts(DB, NOW);
    expect((after.requests.hr ?? 0) - (before.requests.hr ?? 0)).toBe(2);
    expect((after.products.hr ?? 0) - (before.products.hr ?? 0)).toBe(1);
  });

  it("groups first publications and approvals by UTC day", async () => {
    const before = await loadGrowthDays(DB);
    const b = await makeBuilder("gr-b@vnx.si", "gr-b", "approved");
    await addLiveProduct(b, "Gr live", { at: "2026-09-14T23:59:59.000Z" });
    const after = await loadGrowthDays(DB);
    expect((after.products["2026-09-14"] ?? 0) - (before.products["2026-09-14"] ?? 0)).toBe(1);
    expect(Object.values(after.builders).reduce((a, n) => a + n, 0)).toBeGreaterThan(Object.values(before.builders).reduce((a, n) => a + n, 0));
  });
});

describe("top builder inputs", () => {
  it("tallies selected invitations, answered inquiries, reply minutes and verified products for a public builder only", async () => {
    const { builder, inquiry } = await makeInquiry({ tag: "tb-1", status: "answered", now: "2026-10-01T10:00:00.000Z" });
    await run("INSERT INTO inquiry_messages (id, inquiry_id, sender_user_id, kind, body, created_at) VALUES ('tb-msg-1', ?1, ?2, 'message', 'Hello', '2026-10-01T10:30:00.000Z')", inquiry.id, builder.userId);
    const { request } = await makeRequest({ tag: "tb-req", now: "2026-09-20T10:00:00.000Z" });
    const [invite] = await inviteBuilders(request, [builder], "2026-09-21T10:00:00.000Z");
    await run("UPDATE request_invites SET status = 'selected', responded_at = '2026-09-21T11:00:00.000Z' WHERE id = ?1", invite!.id);
    const verified = await addLiveProduct(builder, "Tb verified", { badges: ["demo_verified"] });
    const revoked = await addLiveProduct(builder, "Tb revoked", { badges: ["in_production"] });
    await run("UPDATE product_verifications SET revoked_at = ?2 WHERE product_id = ?1 AND kind = 'in_production'", revoked.id, NOW);
    const mine = (await loadBuilderTallies(DB, NOW)).find((t) => t.userId === builder.userId)!;
    expect(mine).toMatchObject({ handle: "tb-1-b", selected: 1, answered: 1, verified: 1 });
    expect([...mine.replyMinutes].sort((a, b) => a - b)).toEqual([30, 60]); // inquiry 30 min, invitation 60 min
    expect(verified.id).toBeTruthy();
  });

  it("leaves out suspended builders and anything older than 90 days", async () => {
    const old = await makeInquiry({ tag: "tb-old", status: "answered", now: daysBefore(NOW, 91) });
    await run("INSERT INTO inquiry_messages (id, inquiry_id, sender_user_id, kind, body, created_at) VALUES ('tb-msg-old', ?1, ?2, 'message', 'Hi', ?3)", old.inquiry.id, old.builder.userId, daysBefore(NOW, 91));
    expect((await loadBuilderTallies(DB, NOW)).find((t) => t.userId === old.builder.userId)?.answered).toBe(0); // answered, but outside the window
    const edge = await makeInquiry({ tag: "tb-edge", status: "answered", now: daysBefore(NOW, 89) });
    await run("INSERT INTO inquiry_messages (id, inquiry_id, sender_user_id, kind, body, created_at) VALUES ('tb-msg-edge', ?1, ?2, 'message', 'Hi', ?3)", edge.inquiry.id, edge.builder.userId, daysBefore(NOW, 89));
    expect((await loadBuilderTallies(DB, NOW)).find((t) => t.userId === edge.builder.userId)?.answered).toBe(1);
    const sus = await makeInquiry({ tag: "tb-sus", status: "answered", now: daysBefore(NOW, 1) });
    await run("UPDATE builders SET status = 'suspended' WHERE user_id = ?1", sus.builder.userId);
    expect((await loadBuilderTallies(DB, NOW)).find((t) => t.userId === sus.builder.userId)).toBeUndefined();
  });
});

describe("answered inquiries (selected tab)", () => {
  const reply = (id: string, inquiryId: string, builderId: string, kind: string) =>
    run("INSERT INTO inquiry_messages (id, inquiry_id, sender_user_id, kind, body, created_at) VALUES (?1, ?2, ?3, ?4, 'x', ?5)", id, inquiryId, builderId, kind, daysBefore(NOW, 1));
  const answered = async (tag: string) => (await loadBuilderTallies(DB, NOW)).find((t) => t.handle === `${tag}-b`)!.answered;

  it("an inquiry answered and then closed still counts", async () => {
    const x = await makeInquiry({ tag: "an-closed", status: "open", now: daysBefore(NOW, 2) });
    await reply("an-m1", x.inquiry.id, x.builder.userId, "message");
    await run("UPDATE inquiries SET status = 'closed' WHERE id = ?1", x.inquiry.id);
    expect(await answered("an-closed")).toBe(1);
  });
  it("does not count a decline, a removed inquiry, or one the builder never wrote to", async () => {
    const d = await makeInquiry({ tag: "an-decl", status: "open", now: daysBefore(NOW, 2) });
    await reply("an-m2", d.inquiry.id, d.builder.userId, "decline");
    expect(await answered("an-decl")).toBe(0);
    const r = await makeInquiry({ tag: "an-rem", status: "open", now: daysBefore(NOW, 2) });
    await reply("an-m3", r.inquiry.id, r.builder.userId, "message");
    await run("UPDATE inquiries SET status = 'removed' WHERE id = ?1", r.inquiry.id);
    expect(await answered("an-rem")).toBe(0);
    await makeInquiry({ tag: "an-none", status: "answered", now: daysBefore(NOW, 2) }); // status says answered, no builder message
    expect(await answered("an-none")).toBe(0);
  });
  it("does not count invitations of a removed request toward selected or fast reply", async () => {
    const x = await makeInquiry({ tag: "an-inv", status: "open", now: daysBefore(NOW, 2) });
    const { request } = await makeRequest({ tag: "an-inv-req", now: daysBefore(NOW, 2) });
    const [invite] = await inviteBuilders(request, [x.builder], daysBefore(NOW, 2));
    await run("UPDATE request_invites SET status = 'selected', responded_at = ?2 WHERE id = ?1", invite!.id, daysBefore(NOW, 1));
    const mine = async () => (await loadBuilderTallies(DB, NOW)).find((t) => t.userId === x.builder.userId)!;
    expect((await mine()).selected).toBe(1);
    await run("UPDATE requests SET status = 'removed' WHERE id = ?1", request.id);
    expect(await mine()).toMatchObject({ selected: 0, replyMinutes: [] });
  });
});

describe("top product inputs", () => {
  it("gives the active badge score, 30-day inquiries without removed ones, and only public products", async () => {
    const gold = await makeInquiry({ tag: "tp-gold", status: "open", now: daysBefore(NOW, 3) });
    const spam = await makeInquiry({ tag: "tp-spam", status: "open", now: daysBefore(NOW, 3) });
    await run("UPDATE inquiries SET status = 'removed' WHERE id = ?1", spam.inquiry.id);
    const hiddenB = await makeBuilder("tp-h@vnx.si", "tp-h", "pending");
    const hidden = await addLiveProduct(hiddenB, "Tp hidden");
    const list = await loadProductCandidates(DB, NOW);
    expect(list.find((p) => p.id === gold.product!.id)).toMatchObject({ badgeScore: 1, inquiries30d: 1, category: "booking" });
    expect(list.find((p) => p.id === spam.product!.id)?.inquiries30d).toBe(0);
    expect(list.find((p) => p.id === hidden.id)).toBeUndefined();
  });
});

describe("live events", () => {
  const audit = (id: string, action: string, entity: string, entityId: string, data: object, at = daysBefore(NOW, 1)) =>
    run("INSERT INTO audit_log (id, actor_user_id, action, entity, entity_id, data, created_at) VALUES (?1, NULL, ?2, ?3, ?4, ?5, ?6)", id, action, entity, entityId, JSON.stringify(data), at);

  it("returns public events with their time and nothing private", async () => {
    const b = await makeBuilder("lv-b@vnx.si", "lv-b", "approved", { name: "Live Builder" });
    const A = daysBefore(NOW, 1); // the badge is granted at A, so its audit row carries the same time
    const p = await addLiveProduct(b, "Live product", { at: A, badges: ["demo_verified"] });
    const { request } = await makeRequest({ tag: "lv-req", title: "SECRET TITLE", description: "SECRET BODY", category: "crm", languages: ["vi", "en"] });
    const signed = await makeRequest({ tag: "lv-sign", category: "finance", languages: ["zh", "en"] });
    const invited = await makeBuilder("lv-inv@vnx.si", "lv-inv", "approved", { name: "Invited Builder" });
    const pendingData = await makeBuilder("lv-pd@vnx.si", "lv-pd", "approved");
    await audit("lv-01", "product.approve", "product", p.id, { note: "SECRET NOTE" }, A);
    await audit("lv-02", "badge.grant", "product", p.id, { kind: "demo_verified", evidence: "SECRET EVIDENCE" }, A);
    await audit("lv-03", "builder.approve", "builder", b.userId, { note: "SECRET NOTE" });
    await audit("lv-04", "request.verify", "request", request.id, { via: "link", category: "crm", languages: ["vi", "en", "xx"] });
    await audit("lv-05", "request.submit", "request", signed.request.id, { category: "finance", languages: ["zh", "en", "fr"] }); // a signed-in client
    await audit("lv-06", "builder.apply", "builder", invited.userId, { status: "approved", invited: true }); // approved through an invite
    await audit("lv-07", "builder.apply", "builder", pendingData.userId, { status: "pending", invited: false }); // not approved by that apply
    const events = (await loadLiveEvents(DB, NOW)).filter((e) => e.id.startsWith("lv-0"));
    expect(events.map((e) => e.id).sort()).toEqual(["lv-01", "lv-02", "lv-03", "lv-04", "lv-05", "lv-06"]);
    expect(events.find((e) => e.id === "lv-04")).toMatchObject({ kind: "request_new", category: "crm", languages: ["vi", "en"] }); // unknown language dropped
    expect(events.find((e) => e.id === "lv-05")).toMatchObject({ kind: "request_new", category: "finance", languages: ["zh", "en"] }); // zh is a work language
    expect(events.find((e) => e.id === "lv-06")).toMatchObject({ kind: "builder_approved", handle: "lv-inv" });
    expect(JSON.stringify(events)).not.toMatch(/SECRET|Minh Tran|@vnx\.si/);
  });

  it("drops events of things that are no longer public, revoked badges, events older than 7 days and removed requests", async () => {
    const b = await makeBuilder("lv2-b@vnx.si", "lv2-b", "approved");
    const BADGE_AT = daysBefore(NOW, 1);
    const p = await addLiveProduct(b, "Lv2 product", { at: BADGE_AT, badges: ["demo_verified"] });
    await audit("lv-11", "product.approve", "product", p.id, {}, daysBefore(NOW, 8));
    await audit("lv-12", "badge.grant", "product", p.id, { kind: "demo_verified" }, BADGE_AT);
    await run("UPDATE product_verifications SET revoked_at = ?2 WHERE product_id = ?1 AND kind = 'demo_verified'", p.id, NOW);
    const { request } = await makeRequest({ tag: "lv2-req" });
    await audit("lv-13", "request.verify", "request", request.id, { category: "booking", languages: ["en"] });
    await run("UPDATE requests SET status = 'removed' WHERE id = ?1", request.id);
    await run("UPDATE products SET status = 'suspended' WHERE id = ?1", p.id);
    await audit("lv-14", "product.approve", "product", p.id, {});
    const ids = (await loadLiveEvents(DB, NOW)).map((e) => e.id);
    for (const id of ["lv-11", "lv-12", "lv-13", "lv-14"]) expect(ids).not.toContain(id);
    // a badge audit row whose time differs from the badge's own verified_at is not that badge's event
    const q = await addLiveProduct(await makeBuilder("lv3-b@vnx.si", "lv3-b", "approved"), "Lv3 product", { at: BADGE_AT, badges: ["demo_verified"] });
    await audit("lv-15", "badge.grant", "product", q.id, { kind: "demo_verified" }, daysBefore(NOW, 2));
    expect((await loadLiveEvents(DB, NOW)).map((e) => e.id)).not.toContain("lv-15");
  });
});
