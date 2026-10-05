import { describe, expect, it } from "vitest";
import {
  GRANTABLE_ROLES,
  INVITE_TTL_MS,
  OPS_CAPABILITIES,
  OPS_INVITE_STATUSES,
  OPS_ROLES,
  can,
  isExpired,
  opsInviteExpiresAt,
  opsInviteTransition,
  resolveRole,
  type OpsCapability,
  type OpsInviteAction,
  type OpsInviteStatus,
  type OpsRole,
} from "../../src/domain/ops.ts";

describe("ops roles and capabilities (plan O1, spec §3.1)", () => {
  it("has four roles, of which the UI grants three", () => {
    expect(OPS_ROLES).toEqual(["owner", "operator", "content", "viewer"]);
    expect(GRANTABLE_ROLES).toEqual(["operator", "content", "viewer"]);
  });

  it("has exactly the fifteen capabilities of the plan", () => {
    expect([...OPS_CAPABILITIES].sort()).toEqual(
      [
        "overview.view",
        "overview.detail",
        "audit.view",
        "marketplace.view",
        "marketplace.act",
        "users.view",
        "users.act",
        "feedback.view",
        "feedback.act",
        "team.manage",
        "settings.act",
        "monetization.view",
        "monetization.act",
        "content.view",
        "content.act",
      ].sort(),
    );
  });

  // Every role × every capability, written out. true = allowed.
  const EXPECTED: Record<OpsRole, Record<OpsCapability, boolean>> = {
    owner: {
      "overview.view": true,
      "overview.detail": true,
      "audit.view": true,
      "marketplace.view": true,
      "marketplace.act": true,
      "users.view": true,
      "users.act": true,
      "feedback.view": true,
      "feedback.act": true,
      "team.manage": true,
      "settings.act": true,
      "monetization.view": true,
      "monetization.act": true,
      "content.view": true,
      "content.act": true,
    },
    operator: {
      "overview.view": true,
      "overview.detail": true,
      "audit.view": true,
      "marketplace.view": true,
      "marketplace.act": true,
      "users.view": true,
      "users.act": true,
      "feedback.view": true,
      "feedback.act": true,
      "team.manage": false,
      "settings.act": false,
      "monetization.view": false,
      "monetization.act": false,
      "content.view": false,
      "content.act": false,
    },
    content: {
      "overview.view": true,
      "overview.detail": false,
      "audit.view": true,
      "marketplace.view": false,
      "marketplace.act": false,
      "users.view": false,
      "users.act": false,
      "feedback.view": false,
      "feedback.act": false,
      "team.manage": false,
      "settings.act": false,
      "monetization.view": false,
      "monetization.act": false,
      "content.view": true,
      "content.act": true,
    },
    viewer: {
      "overview.view": true,
      "overview.detail": true,
      "audit.view": true,
      "marketplace.view": true,
      "marketplace.act": false,
      "users.view": true,
      "users.act": false,
      "feedback.view": true,
      "feedback.act": false,
      "team.manage": false,
      "settings.act": false,
      "monetization.view": false,
      "monetization.act": false,
      "content.view": true,
      "content.act": false,
    },
  };

  it("the expected table covers every role and every capability", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual([...OPS_ROLES].sort());
    for (const role of OPS_ROLES) expect(Object.keys(EXPECTED[role]).sort(), role).toEqual([...OPS_CAPABILITIES].sort());
  });

  for (const role of OPS_ROLES) {
    for (const capability of OPS_CAPABILITIES) {
      const allowed = EXPECTED[role][capability];
      it(`${role} ${allowed ? "can" : "cannot"} ${capability}`, () => {
        expect(can(role, capability)).toBe(allowed);
      });
    }
  }

  it("only the owner has team.manage, settings.act and monetization.*", () => {
    for (const capability of ["team.manage", "settings.act", "monetization.view", "monetization.act"] as const) {
      expect(OPS_ROLES.filter((role) => can(role, capability)), capability).toEqual(["owner"]);
    }
  });
});

describe("resolveRole (spec §3.2)", () => {
  const admins = new Set(["owner@vnx.si"]);

  it("gives a suspended user no role, even a root owner or a member", () => {
    expect(resolveRole({ userStatus: "suspended", email: "owner@vnx.si", adminEmails: admins, memberRole: null })).toBeNull();
    expect(resolveRole({ userStatus: "suspended", email: "owner@vnx.si", adminEmails: admins, memberRole: "operator" })).toBeNull();
    expect(resolveRole({ userStatus: "suspended", email: "op@vnx.si", adminEmails: admins, memberRole: "operator" })).toBeNull();
  });

  it("makes an e-mail in ADMIN_EMAILS the owner, even with a member row", () => {
    expect(resolveRole({ userStatus: "active", email: "owner@vnx.si", adminEmails: admins, memberRole: null })).toBe("owner");
    expect(resolveRole({ userStatus: "active", email: "owner@vnx.si", adminEmails: admins, memberRole: "viewer" })).toBe("owner");
  });

  it("matches ADMIN_EMAILS without regard to case or surrounding spaces", () => {
    expect(resolveRole({ userStatus: "active", email: " Owner@VNX.si ", adminEmails: admins, memberRole: null })).toBe("owner");
  });

  it("gives a member their granted role", () => {
    for (const role of GRANTABLE_ROLES) {
      expect(resolveRole({ userStatus: "active", email: "member@vnx.si", adminEmails: admins, memberRole: role }), role).toBe(role);
    }
  });

  it("gives anyone else no role", () => {
    expect(resolveRole({ userStatus: "active", email: "someone@vnx.si", adminEmails: admins, memberRole: null })).toBeNull();
    expect(resolveRole({ userStatus: "active", email: "someone@vnx.si", adminEmails: new Set(), memberRole: null })).toBeNull();
  });
});

describe("ops member invitations (plan O1: 7 days)", () => {
  it("lasts exactly seven days", () => {
    expect(INVITE_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
    expect(opsInviteExpiresAt("2026-10-05T08:00:00.000Z")).toBe("2026-10-12T08:00:00.000Z");
  });

  it("has four statuses", () => {
    expect(OPS_INVITE_STATUSES).toEqual(["pending", "accepted", "cancelled", "expired"]);
  });

  it("accepts, cancels or expires only a pending invitation", () => {
    const expected: Record<OpsInviteAction, OpsInviteStatus> = { accept: "accepted", cancel: "cancelled", expire: "expired" };
    for (const action of ["accept", "cancel", "expire"] as const) {
      expect(opsInviteTransition("pending", action), action).toEqual({ ok: true, status: expected[action] });
      for (const status of ["accepted", "cancelled", "expired"] as const) {
        expect(opsInviteTransition(status, action), `${status} ${action}`).toEqual({ ok: false, error: "invalid_transition" });
      }
    }
  });

  it("is expired from the instant expires_at is reached, and not a millisecond before", () => {
    const createdAt = "2026-10-05T08:00:00.000Z";
    const invite = { expiresAt: opsInviteExpiresAt(createdAt) };
    const at = (ms: number) => new Date(Date.parse(createdAt) + ms);
    expect(isExpired(invite, at(0))).toBe(false);
    expect(isExpired(invite, at(INVITE_TTL_MS - 1))).toBe(false);
    expect(isExpired(invite, at(INVITE_TTL_MS))).toBe(true);
    expect(isExpired(invite, at(INVITE_TTL_MS + 1))).toBe(true);
  });
});
