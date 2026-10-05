import { describe, expect, it } from "vitest";
import { auditStatement } from "../../src/db/audit.ts";
import { createMerchant, findMerchantById, listMerchants, parseStoredHosts, setMerchantStatus, updateMerchant } from "../../src/db/merchants.ts";
import type { MerchantInput } from "../../src/domain/merchant.ts";
import { ulid } from "../../src/lib/ulid.ts";
import { ensureUser, makeMerchant } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const NOW = "2026-10-05T00:00:00.000Z";
// Distinct instants: ULIDs are not monotonic inside one millisecond, so audit order is never read from ids.
const at = (n: number) => new Date(Date.parse(NOW) + n * 1000).toISOString();
const slugOf = () => `acme-${ulid().slice(-8).toLowerCase()}`;
const input = (o: Partial<MerchantInput> = {}): MerchantInput => ({
  name: "Acme",
  slug: slugOf(),
  websiteUrl: "https://example.com/",
  allowedHosts: ["example.com", "app.example.com"],
  description: "Plain text.",
  indexable: false,
  ...o,
});
const audits = async (entityId: string) =>
  (await testEnv.DB.prepare("SELECT action, actor_user_id, data FROM audit_log WHERE entity_id = ?1 ORDER BY created_at, id").bind(entityId).all<{ action: string; actor_user_id: string; data: string }>()).results;
const actionsOf = async (entityId: string) => (await audits(entityId)).map((a) => a.action);

describe("db/merchants (addendum §3.2)", () => {
  it("creates a merchant with one audit row", async () => {
    const admin = await ensureUser("m-admin@vnx.si");
    const m = input();
    const res = await createMerchant(testEnv.DB, { merchant: m, status: "paused", actorUserId: admin.id, now: at(1) });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.merchant).toMatchObject({ slug: m.slug, name: "Acme", status: "paused", indexable: false, defaultOfferId: null, logoKey: null, allowedHosts: ["example.com", "app.example.com"], createdAt: at(1), updatedAt: at(1) });
    const rows = await audits(res.merchant.id);
    expect(rows.map((r) => r.action)).toEqual(["merchant.create"]);
    expect(rows[0]?.actor_user_id).toBe(admin.id);
    expect(JSON.parse(rows[0]?.data ?? "{}")).toEqual({ slug: m.slug });
  });

  it("a taken slug returns slug_taken and writes neither a row nor an audit row", async () => {
    const admin = await ensureUser("m-admin@vnx.si");
    const first = input();
    await createMerchant(testEnv.DB, { merchant: first, status: "active", actorUserId: admin.id, now: at(1) });
    const second = await createMerchant(testEnv.DB, { merchant: { ...first, name: "Other" }, status: "active", actorUserId: admin.id, now: at(2) });
    expect(second).toEqual({ ok: false, reason: "slug_taken" });
    const n = async (sql: string) => (await testEnv.DB.prepare(sql).bind(first.slug).first<{ n: number }>())?.n;
    expect(await n("SELECT COUNT(*) AS n FROM merchants WHERE slug = ?1")).toBe(1);
    expect(await n("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'merchant.create' AND json_extract(data, '$.slug') = ?1")).toBe(1);
  });

  it("updates every field except slug and status, with one merchant.update audit row; an unknown id changes nothing", async () => {
    const admin = await ensureUser("m-admin@vnx.si");
    const m = await makeMerchant({ status: "paused" });
    const next = { name: "Renamed", websiteUrl: "https://shop.example.org/", allowedHosts: ["example.org"], description: "New text.", indexable: true };
    const updated = await updateMerchant(testEnv.DB, { id: m.id, merchant: next, actorUserId: admin.id, now: at(5) });
    expect(updated).toMatchObject({ ...next, slug: m.slug, status: "paused", updatedAt: at(5) });
    expect(await actionsOf(m.id)).toEqual(["merchant.create", "merchant.update"]);

    expect(await updateMerchant(testEnv.DB, { id: "missing", merchant: next, actorUserId: admin.id, now: at(6) })).toBeNull();
    expect(await actionsOf("missing")).toEqual([]);
  });

  it("setMerchantStatus is a compare-and-set: the loser writes nothing and audits nothing", async () => {
    const admin = await ensureUser("m-admin@vnx.si");
    const m = await makeMerchant();
    const won = await setMerchantStatus(testEnv.DB, { id: m.id, from: "active", to: "paused", actorUserId: admin.id, now: at(2) });
    expect(won?.status).toBe("paused");
    const lost = await setMerchantStatus(testEnv.DB, { id: m.id, from: "active", to: "archived", actorUserId: admin.id, now: at(3) });
    expect(lost).toBeNull();
    expect((await findMerchantById(testEnv.DB, m.id))?.status).toBe("paused");
    const rows = await audits(m.id);
    expect(rows.map((r) => r.action)).toEqual(["merchant.create", "merchant.status"]);
    expect(JSON.parse(rows[1]?.data ?? "{}")).toEqual({ from: "active", to: "paused" });
  });

  it("archived is terminal and a status to itself is not a change: nothing is written or audited", async () => {
    const admin = await ensureUser("m-admin@vnx.si");
    const m = await makeMerchant();
    expect(await setMerchantStatus(testEnv.DB, { id: m.id, from: "active", to: "active", actorUserId: admin.id, now: at(2) })).toBeNull();
    expect((await setMerchantStatus(testEnv.DB, { id: m.id, from: "active", to: "archived", actorUserId: admin.id, now: at(3) }))?.status).toBe("archived");
    for (const to of ["active", "paused", "archived"] as const) {
      expect(await setMerchantStatus(testEnv.DB, { id: m.id, from: "archived", to, actorUserId: admin.id, now: at(4) }), to).toBeNull();
    }
    expect(await actionsOf(m.id)).toEqual(["merchant.create", "merchant.status"]);
  });

  it("the audit guard is keyed on the row's last write id (a lost write audits nothing)", async () => {
    const admin = await ensureUser("m-admin@vnx.si");
    const m = await makeMerchant();
    const audit = (writeId: string) =>
      auditStatement(testEnv.DB, { actorUserId: admin.id, action: "merchant.update", entity: "merchant", entityId: m.id, now: at(9) }, { partnerTable: "merchants", id: m.id, writeId });
    await audit("not-the-last-write").run();
    expect(await actionsOf(m.id)).toEqual(["merchant.create"]);
    const real = await testEnv.DB.prepare("SELECT write_id FROM merchants WHERE id = ?1").bind(m.id).first<{ write_id: string }>();
    await audit(real?.write_id ?? "").run();
    expect(await actionsOf(m.id)).toEqual(["merchant.create", "merchant.update"]);
  });

  it("parseStoredHosts keeps only public host names and never throws", () => {
    expect(parseStoredHosts('["example.com","Evil.COM","127.0.0.1","localhost","a b.com",7,null]')).toEqual(["example.com"]);
    for (const bad of ["not json", '{"a":1}', '"example.com"', "null", ""]) expect(parseStoredHosts(bad), bad).toEqual([]);
  });

  it("reads allowed_hosts through parseStoredHosts", async () => {
    const m = await makeMerchant();
    await testEnv.DB.prepare("UPDATE merchants SET allowed_hosts = ?2 WHERE id = ?1").bind(m.id, '["example.com","127.0.0.1"]').run();
    expect((await findMerchantById(testEnv.DB, m.id))?.allowedHosts).toEqual(["example.com"]);
    await testEnv.DB.prepare("UPDATE merchants SET allowed_hosts = ?2 WHERE id = ?1").bind(m.id, '{"a":1}').run();
    expect((await findMerchantById(testEnv.DB, m.id))?.allowedHosts).toEqual([]);
  });

  it("finds by id and lists by name", async () => {
    const tag = ulid().slice(-6);
    const z = await makeMerchant({ name: `Zed ${tag}` });
    const a = await makeMerchant({ name: `alpha ${tag}` });
    expect(await findMerchantById(testEnv.DB, "missing")).toBeNull();
    const ids = (await listMerchants(testEnv.DB)).map((m) => m.id).filter((id) => id === z.id || id === a.id);
    expect(ids).toEqual([a.id, z.id]);
  });
});
