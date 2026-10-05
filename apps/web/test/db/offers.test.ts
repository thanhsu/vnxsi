import { describe, expect, it } from "vitest";
import { auditStatement } from "../../src/db/audit.ts";
import { createOffer, findOfferById, listOffersByMerchant, updateOffer } from "../../src/db/offers.ts";
import type { OfferInput } from "../../src/domain/offer.ts";
import { ensureUser, makeMerchant, makeOffer, makeProgram } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const NOW = "2026-10-05T00:00:00.000Z";
const at = (n: number) => new Date(Date.parse(NOW) + n * 1000).toISOString();
const input = (merchant: { id: string }, program: { id: string } | null, o: Partial<OfferInput> = {}): OfferInput => ({
  programId: program?.id ?? null,
  subjectType: "merchant",
  subjectId: merchant.id,
  kind: program ? "affiliate" : "official",
  label: "visit_site",
  destinationUrl: "https://example.com/",
  trackingTemplate: program ? "https://example.com/r?c={click_id}" : null,
  startsAt: null,
  endsAt: null,
  status: "active",
  ...o,
});
const audits = async (entityId: string) =>
  (await testEnv.DB.prepare("SELECT action, data FROM audit_log WHERE entity_id = ?1 ORDER BY created_at, id").bind(entityId).all<{ action: string; data: string }>()).results;
const actionsOf = async (entityId: string) => (await audits(entityId)).map((a) => a.action);
const countFor = async (merchantId: string) => {
  const n = async (sql: string) => (await testEnv.DB.prepare(sql).bind(merchantId).first<{ n: number }>())?.n;
  return {
    offers: await n("SELECT COUNT(*) AS n FROM offers WHERE subject_id = ?1"),
    audits: await n("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'offer.create' AND json_extract(data, '$.merchantId') = ?1"),
  };
};

describe("db/offers writes (addendum §3.2)", () => {
  it("creates an offer with and without a program, one offer.create audit row each", async () => {
    const admin = await ensureUser("o-admin@vnx.si");
    const m = await makeMerchant();
    const p = await makeProgram(m);
    const tracked = await createOffer(testEnv.DB, { offer: input(m, p, { label: "try_it", startsAt: "2026-10-01T00:00:00.000Z" }), actorUserId: admin.id, now: at(1) });
    expect(tracked).toMatchObject({ programId: p.id, subjectType: "merchant", subjectId: m.id, kind: "affiliate", label: "try_it", destinationUrl: "https://example.com/", trackingTemplate: "https://example.com/r?c={click_id}", startsAt: "2026-10-01T00:00:00.000Z", endsAt: null, status: "active", createdAt: at(1), updatedAt: at(1) });
    const plain = await createOffer(testEnv.DB, { offer: input(m, null), actorUserId: admin.id, now: at(2) });
    expect(plain).toMatchObject({ programId: null, trackingTemplate: null });
    const rows = await audits(tracked?.id ?? "");
    expect(rows.map((r) => r.action)).toEqual(["offer.create"]);
    expect(JSON.parse(rows[0]?.data ?? "{}")).toEqual({ merchantId: m.id, programId: p.id });
    expect(await actionsOf(plain?.id ?? "")).toEqual(["offer.create"]);
  });

  it("a merchant that does not exist, or a program of another merchant, gets no offer and no audit row", async () => {
    const admin = await ensureUser("o-admin@vnx.si");
    const m = await makeMerchant();
    const other = await makeMerchant();
    const foreign = await makeProgram(other);
    expect(await createOffer(testEnv.DB, { offer: input({ id: "missing" }, null), actorUserId: admin.id, now: at(1) })).toBeNull();
    expect(await countFor("missing")).toEqual({ offers: 0, audits: 0 });
    expect(await createOffer(testEnv.DB, { offer: input(m, foreign), actorUserId: admin.id, now: at(2) })).toBeNull();
    expect(await countFor(m.id)).toEqual({ offers: 0, audits: 0 });
  });

  it("the database is the last barrier: an empty template with a program, or an unknown label, throws and leaves nothing", async () => {
    const admin = await ensureUser("o-admin@vnx.si");
    const m = await makeMerchant();
    const p = await makeProgram(m);
    await expect(createOffer(testEnv.DB, { offer: input(m, p, { trackingTemplate: "" }), actorUserId: admin.id, now: at(1) })).rejects.toThrow();
    await expect(createOffer(testEnv.DB, { offer: input(m, p, { trackingTemplate: null }), actorUserId: admin.id, now: at(1) })).rejects.toThrow();
    await expect(createOffer(testEnv.DB, { offer: input(m, null, { label: "buy_now" as never }), actorUserId: admin.id, now: at(1) })).rejects.toThrow();
    expect(await countFor(m.id)).toEqual({ offers: 0, audits: 0 });
  });

  it("updateOffer: a field edit audits offer.update, a status change audits offer.status with from and to", async () => {
    const admin = await ensureUser("o-admin@vnx.si");
    const m = await makeMerchant();
    const p = await makeProgram(m);
    const o = await makeOffer(m, p);
    const edited = await updateOffer(testEnv.DB, { id: o.id, offer: input(m, p, { label: "try_it", endsAt: "2027-01-01T00:00:00.000Z" }), expectedStatus: "active", actorUserId: admin.id, now: at(2) });
    expect(edited).toMatchObject({ label: "try_it", endsAt: "2027-01-01T00:00:00.000Z", status: "active", subjectId: m.id, updatedAt: at(2), createdAt: o.createdAt });
    const paused = await updateOffer(testEnv.DB, { id: o.id, offer: input(m, p, { status: "paused" }), expectedStatus: "active", actorUserId: admin.id, now: at(3) });
    expect(paused?.status).toBe("paused");
    const rows = await audits(o.id);
    expect(rows.map((r) => r.action)).toEqual(["offer.create", "offer.update", "offer.status"]);
    expect(JSON.parse(rows[2]?.data ?? "{}")).toEqual({ from: "active", to: "paused" });
  });

  it("updateOffer is a compare-and-set on status: a stale caller changes and audits nothing", async () => {
    const admin = await ensureUser("o-admin@vnx.si");
    const m = await makeMerchant();
    const o = await makeOffer(m, null, { status: "paused" });
    const lost = await updateOffer(testEnv.DB, { id: o.id, offer: input(m, null, { label: "try_it", status: "active" }), expectedStatus: "active", actorUserId: admin.id, now: at(2) });
    expect(lost).toBeNull();
    expect(await findOfferById(testEnv.DB, o.id)).toMatchObject({ label: "visit_site", status: "paused" });
    expect(await actionsOf(o.id)).toEqual(["offer.create"]);
    expect(await updateOffer(testEnv.DB, { id: "missing", offer: input(m, null), expectedStatus: "active", actorUserId: admin.id, now: at(3) })).toBeNull();
  });

  it("updateOffer never moves an offer to another merchant or onto another merchant's program", async () => {
    const admin = await ensureUser("o-admin@vnx.si");
    const m = await makeMerchant();
    const other = await makeMerchant();
    const foreign = await makeProgram(other);
    const o = await makeOffer(m, null);
    expect(await updateOffer(testEnv.DB, { id: o.id, offer: input(other, null), expectedStatus: "active", actorUserId: admin.id, now: at(2) })).toBeNull();
    expect(await updateOffer(testEnv.DB, { id: o.id, offer: input(m, foreign), expectedStatus: "active", actorUserId: admin.id, now: at(3) })).toBeNull();
    expect(await findOfferById(testEnv.DB, o.id)).toMatchObject({ subjectId: m.id, programId: null });
    expect(await actionsOf(o.id)).toEqual(["offer.create"]);
  });

  it("archived is terminal: no transition out of it, but an archived offer can still be edited", async () => {
    const admin = await ensureUser("o-admin@vnx.si");
    const m = await makeMerchant();
    const o = await makeOffer(m, null, { status: "archived" });
    for (const to of ["active", "paused"] as const) {
      expect(await updateOffer(testEnv.DB, { id: o.id, offer: input(m, null, { status: to }), expectedStatus: "archived", actorUserId: admin.id, now: at(2) }), to).toBeNull();
    }
    expect((await findOfferById(testEnv.DB, o.id))?.status).toBe("archived");
    expect((await updateOffer(testEnv.DB, { id: o.id, offer: input(m, null, { label: "learn_more", status: "archived" }), expectedStatus: "archived", actorUserId: admin.id, now: at(3) }))?.label).toBe("learn_more");
    const live = await makeOffer(m, null);
    expect((await updateOffer(testEnv.DB, { id: live.id, offer: input(m, null, { status: "archived" }), expectedStatus: "active", actorUserId: admin.id, now: at(4) }))?.status).toBe("archived");
    expect(await actionsOf(o.id)).toEqual(["offer.create", "offer.update"]);
  });

  it("updateOffer only touches merchant offers: one whose subject_type is product returns null and stays unchanged", async () => {
    const admin = await ensureUser("o-admin@vnx.si");
    const m = await makeMerchant();
    const o = await makeOffer(m, null);
    await testEnv.DB.prepare("UPDATE offers SET subject_type = 'product' WHERE id = ?1").bind(o.id).run();
    expect(await updateOffer(testEnv.DB, { id: o.id, offer: input(m, null, { label: "try_it" }), expectedStatus: "active", actorUserId: admin.id, now: at(2) })).toBeNull();
    expect(await findOfferById(testEnv.DB, o.id)).toMatchObject({ label: "visit_site", subjectType: "product" });
    expect(await actionsOf(o.id)).toEqual(["offer.create"]);
  });

  it("the audit guard is keyed on the offer's last write id (a lost write audits nothing)", async () => {
    const admin = await ensureUser("o-admin@vnx.si");
    const m = await makeMerchant();
    const o = await makeOffer(m, null);
    const audit = (writeId: string) =>
      auditStatement(testEnv.DB, { actorUserId: admin.id, action: "offer.update", entity: "offer", entityId: o.id, now: at(9) }, { partnerTable: "offers", id: o.id, writeId });
    await audit("not-the-last-write").run();
    expect(await actionsOf(o.id)).toEqual(["offer.create"]);
    const real = await testEnv.DB.prepare("SELECT write_id FROM offers WHERE id = ?1").bind(o.id).first<{ write_id: string }>();
    await audit(real?.write_id ?? "").run();
    expect(await actionsOf(o.id)).toEqual(["offer.create", "offer.update"]);
  });

  it("finds by id and lists a merchant's offers oldest first, none of another merchant's", async () => {
    const m = await makeMerchant();
    const other = await makeMerchant();
    const a = await makeOffer(m, null);
    const b = await makeOffer(m, null, { label: "try_it" });
    await makeOffer(other, null);
    expect(await findOfferById(testEnv.DB, "missing")).toBeNull();
    expect((await listOffersByMerchant(testEnv.DB, m.id)).map((o) => o.id)).toEqual([a.id, b.id]);
  });
});
