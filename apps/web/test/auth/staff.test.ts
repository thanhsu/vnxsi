import { describe, expect, it } from "vitest";
import { isAdminUser } from "../../src/auth/admin.ts";
import { isStaff } from "../../src/auth/staff.ts";
import { testEnv } from "../helpers.ts";

const admins = { ADMIN_EMAILS: "owner@vnx.si, Second@VNX.si" };
const envWith = (ADMIN_EMAILS: string | undefined) => ({ DB: testEnv.DB, ADMIN_EMAILS });

describe("isAdminUser: exactly the /admin guard expression (requireAdmin calls it)", () => {
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

describe("isStaff (async; today the same answer as isAdminUser, Ops O1 widens it at merge)", () => {
  it("is true for an admin user in ADMIN_EMAILS", async () => {
    expect(await isStaff(envWith(admins.ADMIN_EMAILS), { email: "owner@vnx.si", isAdmin: true })).toBe(true);
  });
  it("is false for a flag-less user, a revoked e-mail, an unset list or no user", async () => {
    expect(await isStaff(envWith(admins.ADMIN_EMAILS), { email: "owner@vnx.si", isAdmin: false })).toBe(false);
    expect(await isStaff(envWith(admins.ADMIN_EMAILS), { email: "gone@vnx.si", isAdmin: true })).toBe(false);
    expect(await isStaff(envWith(undefined), { email: "owner@vnx.si", isAdmin: true })).toBe(false);
    expect(await isStaff(envWith(admins.ADMIN_EMAILS), null)).toBe(false);
  });
});
