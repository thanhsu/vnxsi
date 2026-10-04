export const BUILDER_KINDS = ["individual", "team", "company"] as const;
export type BuilderKind = (typeof BUILDER_KINDS)[number];
export const AVAILABILITIES = ["open", "limited", "closed"] as const;
export type Availability = (typeof AVAILABILITIES)[number];
export const WORK_LANGUAGES = ["en", "vi", "zh"] as const;
export type WorkLanguage = (typeof WORK_LANGUAGES)[number];
export const BUILDER_STATUSES = ["pending", "approved", "rejected", "suspended"] as const;
export type BuilderStatus = (typeof BUILDER_STATUSES)[number];

/** The fields a builder edits (spec §5.3, §6.1). */
export interface BuilderProfile {
  handle: string;
  name: string;
  kind: BuilderKind;
  headline: string;
  bio: string;
  country: string;
  websiteUrl: string | null;
  skills: string[];
  aiTools: string[];
  workLanguages: WorkLanguage[];
  availability: Availability;
  hourlyRateCents: number | null;
}

export interface Builder extends BuilderProfile {
  userId: string;
  status: BuilderStatus;
  reviewNote: string | null;
  inviteCodeHash: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A builder joined with its account, for admin screens and e-mail. */
export interface BuilderAccount extends Builder {
  email: string;
  userLocale: string;
  userStatus: "active" | "suspended";
}

export type BuilderAction = "approve" | "reject" | "suspend" | "unsuspend" | "resubmit";
export type BuilderActor = "admin" | "owner";
export type BuilderTransition = { ok: true; status: BuilderStatus } | { ok: false; error: "invalid_transition" };

const RULES: Record<BuilderAction, { from: BuilderStatus; to: BuilderStatus; actor: BuilderActor }> = {
  approve: { from: "pending", to: "approved", actor: "admin" },
  reject: { from: "pending", to: "rejected", actor: "admin" },
  suspend: { from: "approved", to: "suspended", actor: "admin" },
  unsuspend: { from: "suspended", to: "approved", actor: "admin" },
  resubmit: { from: "rejected", to: "pending", actor: "owner" },
};

/** Spec §7.1. The invite path (straight to approved) happens at creation, in db/builders. */
export function transition(status: BuilderStatus, action: BuilderAction, actor: BuilderActor): BuilderTransition {
  const rule = RULES[action];
  if (rule.from !== status || rule.actor !== actor) return { ok: false, error: "invalid_transition" };
  return { ok: true, status: rule.to };
}

export function isBuilderStatus(value: unknown): value is BuilderStatus {
  return (BUILDER_STATUSES as readonly unknown[]).includes(value);
}

/** Suspended builders can read the Hub but not change anything. */
export function canEditProfile(status: BuilderStatus): boolean {
  return status !== "suspended";
}

/** Owner decision 2026-10-03: the handle locks once the profile is approved. */
export function canChangeHandle(status: BuilderStatus): boolean {
  return status === "pending" || status === "rejected";
}
