import { describe, expect, it } from "vitest";
import { BUILDER_STATUSES, canChangeHandle, canEditProfile, transition, type BuilderAction } from "../../src/domain/builder.ts";
import { inviteState } from "../../src/domain/invite.ts";

describe("builder state machine (spec §7.1)", () => {
  it.each([
    ["pending", "approve", "admin", "approved"],
    ["pending", "reject", "admin", "rejected"],
    ["approved", "suspend", "admin", "suspended"],
    ["suspended", "unsuspend", "admin", "approved"],
    ["rejected", "resubmit", "owner", "pending"],
  ] as const)("%s --%s by %s--> %s", (from, action, actor, to) => {
    expect(transition(from, action, actor)).toEqual({ ok: true, status: to });
  });

  it("rejects every other combination", () => {
    const valid = new Set(["pending:approve:admin", "pending:reject:admin", "approved:suspend:admin", "suspended:unsuspend:admin", "rejected:resubmit:owner"]);
    const actions: BuilderAction[] = ["approve", "reject", "suspend", "unsuspend", "resubmit"];
    for (const status of BUILDER_STATUSES) {
      for (const action of actions) {
        for (const actor of ["admin", "owner"] as const) {
          if (valid.has(`${status}:${action}:${actor}`)) continue;
          expect(transition(status, action, actor), `${status}:${action}:${actor}`).toEqual({ ok: false, error: "invalid_transition" });
        }
      }
    }
  });

  it("locks the handle after approval and all edits while suspended", () => {
    expect(BUILDER_STATUSES.filter((s) => canChangeHandle(s))).toEqual(["pending", "rejected"]);
    expect(BUILDER_STATUSES.filter((s) => canEditProfile(s))).toEqual(["pending", "approved", "rejected"]);
  });
});

describe("invite state", () => {
  const now = new Date("2026-10-03T10:00:00.000Z");
  it("is active, used up or expired", () => {
    expect(inviteState({ uses: 0, maxUses: 1, expiresAt: "2026-10-04T00:00:00.000Z" }, now)).toBe("active");
    expect(inviteState({ uses: 1, maxUses: 1, expiresAt: "2026-10-04T00:00:00.000Z" }, now)).toBe("used_up");
    expect(inviteState({ uses: 0, maxUses: 1, expiresAt: "2026-10-03T10:00:00.000Z" }, now)).toBe("expired");
  });
});
