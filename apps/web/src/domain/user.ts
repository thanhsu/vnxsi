import type { BuilderStatus } from "./builder.ts";

export const USER_STATUSES = ["active", "suspended"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];
export type UserAction = "suspend" | "unsuspend";

/** One row of the admin user search. */
export interface UserSummary {
  id: string;
  email: string;
  status: UserStatus;
  isAdmin: boolean;
  builderHandle: string | null;
  builderStatus: BuilderStatus | null;
}

const RULES: Record<UserAction, { from: UserStatus; to: UserStatus }> = {
  suspend: { from: "active", to: "suspended" },
  unsuspend: { from: "suspended", to: "active" },
};

export function userTransition(status: UserStatus, action: UserAction): { ok: true; status: UserStatus } | { ok: false; error: "invalid_transition" } {
  const rule = RULES[action];
  return rule.from === status ? { ok: true, status: rule.to } : { ok: false, error: "invalid_transition" };
}
