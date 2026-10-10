import { describe, expect, it } from "vitest";
import { isAdminUser } from "../../src/auth/admin.ts";
import { isStaff } from "../../src/auth/staff.ts";
import type { SessionUser } from "../../src/auth/sessions.ts";
import { ensureUser } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const admins = { ADMIN_EMAILS: "owner@vnx.si, Second@VNX.si" };
const su = (email: string, isAdmin: boolean): SessionUser => ({ id: `no-such-user-${email}`, email, locale: "en", isAdmin, method: "magic_link" });
const envWith = (ADMIN_EMAILS: string | undefined) => ({ DB: testEnv.DB, ADMIN_EMAILS });

describe("isAdminUser: the admin e-mail and flag check (requireAdmin calls it, and the /admin guard ALSO requires a magic-link session)", () => {
  it("is true for an admin user whose e-mail is in ADMIN_EMAILS", () => {
    expect(isAdminUser({ email: "owner@vnx.si", isAdmin: true }, admins)).toBe(true);
    expect(isAdminUser({ email: "second@vnx.si", isAdmin: true }, admins)).toBe(true);
  });
  it("is false without the is_admin flag, even when the e-mail is listed", () => {
    expect(isAdminUser({ email: "owner@vnx.si", isAdmin: false }, admins)).toBe(false);
  });
  it("is false when the e-mail is no longer listed (revocation), or the list is unset or empty", () => {
    expect(isAdminUser({ email: "gone@vnx.si", isAdmin: true }, admins)).toBe(false);
    expect(isAdminUser({ email: "owner@vnx.si", isAdmin: true }, {})).toBe(false);
    expect(isAdminUser({ email: "owner@vnx.si", isAdmin: true }, { ADMIN_EMAILS: "" })).toBe(false);
  });
  it("is false for a visitor who is not signed in", () => {
    expect(isAdminUser(null, admins)).toBe(false);
    expect(isAdminUser(undefined, admins)).toBe(false);
  });
});

describe("isStaff (async; the admin predicate or any Ops member, however they signed in)", () => {
  it("is true for an admin user in ADMIN_EMAILS", async () => {
    expect(await isStaff(envWith(admins.ADMIN_EMAILS), su("owner@vnx.si", true))).toBe(true);
  });
  it("is false for a flag-less user, a revoked e-mail, an unset list or no user", async () => {
    expect(await isStaff(envWith(admins.ADMIN_EMAILS), su("owner@vnx.si", false))).toBe(false);
    expect(await isStaff(envWith(admins.ADMIN_EMAILS), su("gone@vnx.si", true))).toBe(false);
    expect(await isStaff(envWith(undefined), su("owner@vnx.si", true))).toBe(false);
    expect(await isStaff(envWith(admins.ADMIN_EMAILS), null)).toBe(false);
  });
  it("is true for the owner and for an Ops member whatever the sign-in: an oauth_* session is still staff (excluded from stats)", async () => {
    expect(await isStaff(envWith(admins.ADMIN_EMAILS), { ...su("owner@vnx.si", true), method: "oauth_github" })).toBe(true);
    const owner = await ensureUser("owner@vnx.si");
    const member = await ensureUser("staff-oauth@vnx.si");
    const now = new Date().toISOString();
    await testEnv.DB.prepare("INSERT INTO ops_members (user_id, role, granted_by, granted_at, updated_at) VALUES (?1, 'viewer', ?2, ?3, ?3)").bind(member.id, owner.id, now).run();
    for (const method of ["oauth_google", "oauth_github", "oauth_linkedin"] as const)
      expect(await isStaff(envWith(admins.ADMIN_EMAILS), { id: member.id, email: member.email, locale: member.locale, isAdmin: false, method })).toBe(true);
  });
  it("is true for an Ops member of the lowest role (Viewer) who is not an admin; false for a plain user", async () => {
    const owner = await ensureUser("owner@vnx.si");
    const viewer = await ensureUser("staff-viewer@vnx.si");
    const plain = await ensureUser("staff-plain@vnx.si");
    const now = new Date().toISOString();
    await testEnv.DB.prepare("INSERT INTO ops_members (user_id, role, granted_by, granted_at, updated_at) VALUES (?1, 'viewer', ?2, ?3, ?3)").bind(viewer.id, owner.id, now).run();
    const asSession = (u: { id: string; email: string; locale: string }): SessionUser => ({ id: u.id, email: u.email, locale: u.locale, isAdmin: false, method: "magic_link" });
    expect(await isStaff(envWith(admins.ADMIN_EMAILS), asSession(viewer))).toBe(true);
    expect(await isStaff(envWith(admins.ADMIN_EMAILS), asSession(plain))).toBe(false);
  });
});
