import { describe, expect, it } from "vitest";
import { createProgram, findProgramById, listProgramsByMerchant, updateProgram } from "../../src/db/programs.ts";
import type { ProgramInput } from "../../src/domain/offer.ts";
import { ensureUser, makeMerchant, makeProgram } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const NOW = "2026-10-05T00:00:00.000Z";
const at = (n: number) => new Date(Date.parse(NOW) + n * 1000).toISOString();
const program = (o: Partial<ProgramInput> = {}): ProgramInput => ({
  name: "Acme program",
  type: "affiliate",
  network: null,
  provider: "manual",
  commissionModel: null,
  commissionRateBps: null,
  commissionFlatMinor: null,
  currency: null,
  cookieDays: null,
  attributionNotes: null,
  termsUrl: null,
  termsVerifiedAt: null,
  status: "draft",
  ...o,
});
const TERMS = { termsUrl: "https://example.com/terms", termsVerifiedAt: "2026-10-01" };
const audits = async (entityId: string) =>
  (await testEnv.DB.prepare("SELECT action, data FROM audit_log WHERE entity_id = ?1 ORDER BY created_at, id").bind(entityId).all<{ action: string; data: string }>()).results;
const createAudits = async (merchantId: string) =>
  (await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'program.create' AND json_extract(data, '$.merchantId') = ?1").bind(merchantId).first<{ n: number }>())?.n;

describe("db/programs (addendum §3.2, Review Focus 6)", () => {
  it("creates a program with no commission, cookie or currency defaulted, and one program.create audit row", async () => {
    const admin = await ensureUser("p-admin@vnx.si");
    const m = await makeMerchant();
    const p = await createProgram(testEnv.DB, { merchantId: m.id, program: program({ network: "ExampleNet" }), actorUserId: admin.id, now: at(1) });
    expect(p).toMatchObject({ merchantId: m.id, name: "Acme program", type: "affiliate", network: "ExampleNet", status: "draft", commissionModel: null, commissionRateBps: null, commissionFlatMinor: null, currency: null, cookieDays: null, termsUrl: null, termsVerifiedAt: null });
    const rows = await audits(p?.id ?? "");
    expect(rows.map((a) => a.action)).toEqual(["program.create"]);
    expect(JSON.parse(rows[0]?.data ?? "{}")).toEqual({ merchantId: m.id, type: "affiliate" });
  });

  it("stores the numbers given and nothing else", async () => {
    const admin = await ensureUser("p-admin@vnx.si");
    const m = await makeMerchant();
    const p = await createProgram(testEnv.DB, {
      merchantId: m.id,
      program: program({ commissionModel: "percent", commissionRateBps: 3000, currency: "USD", cookieDays: 60, attributionNotes: "last click", ...TERMS, status: "active" }),
      actorUserId: admin.id,
      now: at(1),
    });
    expect(p).toMatchObject({ commissionModel: "percent", commissionRateBps: 3000, commissionFlatMinor: null, currency: "USD", cookieDays: 60, attributionNotes: "last click", status: "active", ...TERMS });
  });

  it("a merchant that does not exist gets no program and no audit row", async () => {
    const admin = await ensureUser("p-admin@vnx.si");
    expect(await createProgram(testEnv.DB, { merchantId: "missing", program: program(), actorUserId: admin.id, now: at(1) })).toBeNull();
    expect(await createAudits("missing")).toBe(0);
  });

  it("the database also refuses an active program without terms, or of type direct (defence in depth: the domain refuses first), leaving no row and no audit row", async () => {
    const admin = await ensureUser("p-admin@vnx.si");
    const m = await makeMerchant();
    for (const bad of [program({ status: "active" }), program({ status: "active", termsUrl: TERMS.termsUrl }), program({ status: "active", type: "direct", ...TERMS })]) {
      await expect(createProgram(testEnv.DB, { merchantId: m.id, program: bad, actorUserId: admin.id, now: at(1) })).rejects.toThrow();
    }
    expect((await listProgramsByMerchant(testEnv.DB, m.id)).length).toBe(0);
    expect(await createAudits(m.id)).toBe(0);
  });

  it("updateProgram: a field edit audits program.update, a status change audits program.status with from and to", async () => {
    const admin = await ensureUser("p-admin@vnx.si");
    const m = await makeMerchant();
    const p = await makeProgram(m, { status: "draft" });
    const edited = await updateProgram(testEnv.DB, { id: p.id, program: { ...program(), name: "Renamed", cookieDays: 30 }, expectedStatus: "draft", actorUserId: admin.id, now: at(2) });
    expect(edited).toMatchObject({ name: "Renamed", cookieDays: 30, status: "draft", updatedAt: at(2) });
    const activated = await updateProgram(testEnv.DB, { id: p.id, program: program({ ...TERMS, status: "active" }), expectedStatus: "draft", actorUserId: admin.id, now: at(3) });
    expect(activated).toMatchObject({ status: "active", ...TERMS });
    const rows = await audits(p.id);
    expect(rows.map((r) => r.action)).toEqual(["program.create", "program.update", "program.status"]);
    expect(JSON.parse(rows[2]?.data ?? "{}")).toEqual({ from: "draft", to: "active" });
  });

  it("updateProgram is a compare-and-set on status: a stale caller changes and audits nothing", async () => {
    const admin = await ensureUser("p-admin@vnx.si");
    const m = await makeMerchant();
    const p = await makeProgram(m, { status: "paused" });
    const lost = await updateProgram(testEnv.DB, { id: p.id, program: program({ name: "Late", ...TERMS, status: "active" }), expectedStatus: "draft", actorUserId: admin.id, now: at(2) });
    expect(lost).toBeNull();
    expect(await findProgramById(testEnv.DB, p.id)).toMatchObject({ name: p.name, status: "paused" });
    expect((await audits(p.id)).map((a) => a.action)).toEqual(["program.create"]);
    expect(await updateProgram(testEnv.DB, { id: "missing", program: program(), expectedStatus: "draft", actorUserId: admin.id, now: at(3) })).toBeNull();
  });

  it("the database also refuses updateProgram to active without terms or of type direct (defence in depth), leaving row and audit unchanged", async () => {
    const admin = await ensureUser("p-admin@vnx.si");
    const m = await makeMerchant();
    const p = await makeProgram(m, { status: "draft" });
    await expect(updateProgram(testEnv.DB, { id: p.id, program: program({ status: "active" }), expectedStatus: "draft", actorUserId: admin.id, now: at(2) })).rejects.toThrow();
    await expect(updateProgram(testEnv.DB, { id: p.id, program: program({ type: "direct", ...TERMS, status: "active" }), expectedStatus: "draft", actorUserId: admin.id, now: at(3) })).rejects.toThrow();
    expect((await findProgramById(testEnv.DB, p.id))?.status).toBe("draft");
    expect((await audits(p.id)).map((a) => a.action)).toEqual(["program.create"]);
  });

  it("ended is terminal: no transition out of it, but an ended program can still be edited", async () => {
    const admin = await ensureUser("p-admin@vnx.si");
    const m = await makeMerchant();
    const p = await makeProgram(m, { status: "ended" });
    for (const to of ["draft", "active", "paused"] as const) {
      expect(await updateProgram(testEnv.DB, { id: p.id, program: program({ ...TERMS, status: to }), expectedStatus: "ended", actorUserId: admin.id, now: at(2) }), to).toBeNull();
    }
    expect((await findProgramById(testEnv.DB, p.id))?.status).toBe("ended");
    expect((await updateProgram(testEnv.DB, { id: p.id, program: program({ ...TERMS, name: "Closed", status: "ended" }), expectedStatus: "ended", actorUserId: admin.id, now: at(3) }))?.name).toBe("Closed");
    expect((await audits(p.id)).map((a) => a.action)).toEqual(["program.create", "program.update"]);
  });

  it("finds by id and lists a merchant's programs oldest first", async () => {
    const m = await makeMerchant();
    const other = await makeMerchant();
    const a = await makeProgram(m, { name: "A" });
    const b = await makeProgram(m, { name: "B" });
    await makeProgram(other);
    expect(await findProgramById(testEnv.DB, "missing")).toBeNull();
    expect((await listProgramsByMerchant(testEnv.DB, m.id)).map((p) => p.id)).toEqual([a.id, b.id]);
  });
});
