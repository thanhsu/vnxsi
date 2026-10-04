import { describe, expect, it } from "vitest";
import { sha256Hex } from "../../src/auth/crypto.ts";
import { createBuilder, findBuilderByHandle, findBuilderByUserId, setBuilderStatus, updateBuilderProfile } from "../../src/db/builders.ts";
import { createInvite, findInvite } from "../../src/db/invites.ts";
import { ensureUser, profileOf } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const NOW = "2026-10-03T10:00:00.000Z";
const LATER = "2026-10-04T10:00:00.000Z";
const db = () => testEnv.DB;

async function invite(code: string, o: { maxUses?: number; expiresAt?: string } = {}): Promise<string> {
  const admin = await ensureUser("db-inviter@vnx.si");
  const codeHash = await sha256Hex(code);
  await createInvite(db(), { codeHash, createdBy: admin.id, maxUses: o.maxUses ?? 1, expiresAt: o.expiresAt ?? LATER, note: null, now: NOW });
  return codeHash;
}

async function build(email: string, handle: string, inviteCodeHash: string | null = null) {
  const user = await ensureUser(email);
  return { user, result: await createBuilder(db(), { userId: user.id, profile: profileOf({ handle }), inviteCodeHash, now: NOW }) };
}

describe("db/builders", () => {
  it("creates a pending builder without an invite and stores lists as JSON", async () => {
    const { user, result } = await build("db-b1@vnx.si", "db-one");
    expect(result).toMatchObject({ ok: true, builder: { status: "pending", handle: "db-one", skills: ["Next.js", "Supabase"], workLanguages: ["en", "vi"], hourlyRateCents: 4500, inviteCodeHash: null, approvedAt: null } });
    expect(await findBuilderByHandle(db(), "db-one")).toMatchObject({ userId: user.id });
    const raw = await db().prepare("SELECT skills FROM builders WHERE user_id = ?1").bind(user.id).first<{ skills: string }>();
    expect(raw?.skills).toBe('["Next.js","Supabase"]');
  });

  it("approves right away with a usable invite and spends one use", async () => {
    const hash = await invite("db-code-ok");
    const { result } = await build("db-b2@vnx.si", "db-two", hash);
    expect(result).toMatchObject({ ok: true, builder: { status: "approved", inviteCodeHash: hash, approvedAt: NOW } });
    expect((await findInvite(db(), hash))?.uses).toBe(1);
  });

  it("falls back to pending with a used-up or expired invite and does not spend it", async () => {
    const used = await invite("db-code-used", { maxUses: 1 });
    await build("db-b3@vnx.si", "db-three", used);
    const { result } = await build("db-b4@vnx.si", "db-four", used);
    expect(result).toMatchObject({ ok: true, builder: { status: "pending", inviteCodeHash: null, approvedAt: null } });
    expect((await findInvite(db(), used))?.uses).toBe(1);

    const expired = await invite("db-code-expired", { expiresAt: NOW });
    const second = await build("db-b5@vnx.si", "db-five", expired);
    expect(second.result).toMatchObject({ ok: true, builder: { status: "pending" } });
    expect((await findInvite(db(), expired))?.uses).toBe(0);
  });

  it("reports a taken handle and rolls back the invite use", async () => {
    const hash = await invite("db-code-rollback", { maxUses: 5 });
    await build("db-b6@vnx.si", "db-same");
    const { user, result } = await build("db-b7@vnx.si", "db-same", hash);
    expect(result).toEqual({ ok: false, reason: "handle_taken" });
    expect((await findInvite(db(), hash))?.uses).toBe(0);
    expect(await findBuilderByUserId(db(), user.id)).toBeNull();
  });

  it("refuses a second builder for the same user", async () => {
    await build("db-b8@vnx.si", "db-eight");
    const { result } = await build("db-b8@vnx.si", "db-eight-2");
    expect(result).toEqual({ ok: false, reason: "already_builder" });
  });

  it("updates a profile only while the status is the expected one", async () => {
    const { user } = await build("db-b9@vnx.si", "db-nine");
    expect(await updateBuilderProfile(db(), { userId: user.id, expectedStatus: "pending", profile: profileOf({ handle: "db-nine-x", name: "New Name" }), now: LATER })).toBe("ok");
    expect(await findBuilderByUserId(db(), user.id)).toMatchObject({ handle: "db-nine-x", name: "New Name", updatedAt: LATER });
    expect(await updateBuilderProfile(db(), { userId: user.id, expectedStatus: "approved", profile: profileOf({ handle: "db-nine-x" }), now: LATER })).toBe("stale");
    await build("db-b10@vnx.si", "db-ten");
    expect(await updateBuilderProfile(db(), { userId: user.id, expectedStatus: "pending", profile: profileOf({ handle: "db-ten" }), now: LATER })).toBe("handle_taken");
  });

  it("changes status atomically and keeps the first approval time", async () => {
    const { user } = await build("db-b11@vnx.si", "db-eleven");
    expect(await setBuilderStatus(db(), { userId: user.id, from: "pending", to: "approved", reviewNote: null, now: NOW })).toMatchObject({ status: "approved", approvedAt: NOW });
    expect(await setBuilderStatus(db(), { userId: user.id, from: "pending", to: "rejected", reviewNote: "x", now: LATER })).toBeNull();
    expect(await setBuilderStatus(db(), { userId: user.id, from: "approved", to: "suspended", reviewNote: "spam", now: LATER })).toMatchObject({ status: "suspended", reviewNote: "spam" });
    expect(await setBuilderStatus(db(), { userId: user.id, from: "suspended", to: "approved", reviewNote: null, now: LATER })).toMatchObject({ approvedAt: NOW, reviewNote: null });
  });
});
