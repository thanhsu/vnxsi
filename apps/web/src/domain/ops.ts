import type { UserStatus } from "./user.ts";

/** Ops console roles, capabilities and member invitations (plan O1, VNX-2501; spec §3, ADR-010). Pure rules: no Hono, no D1. */

export const OPS_ROLES = ["owner", "operator", "content", "viewer"] as const;
export type OpsRole = (typeof OPS_ROLES)[number];
/** The roles an Owner can grant. `owner` is never granted: it comes only from ADMIN_EMAILS. */
export const GRANTABLE_ROLES = ["operator", "content", "viewer"] as const;
export type GrantableRole = (typeof GRANTABLE_ROLES)[number];

/** Each /ops route declares exactly one of these. `content.*` is reserved for O3 and has no route yet. */
export const OPS_CAPABILITIES = [
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
] as const;
export type OpsCapability = (typeof OPS_CAPABILITIES)[number];

/**
 * Spec §3.1 and plan O1. Owner: everything. Operator: overview, audit, marketplace, users, feedback. Content: aggregate
 * overview only (no `overview.detail`), audit, content. Viewer: every `*.view` of the areas above plus overview detail.
 * Team, settings and monetization are Owner-only.
 */
const GRANTS: Record<OpsRole, ReadonlySet<OpsCapability>> = {
  owner: new Set(OPS_CAPABILITIES),
  operator: new Set<OpsCapability>([
    "overview.view",
    "overview.detail",
    "audit.view",
    "marketplace.view",
    "marketplace.act",
    "users.view",
    "users.act",
    "feedback.view",
    "feedback.act",
  ]),
  content: new Set<OpsCapability>(["overview.view", "audit.view", "content.view", "content.act"]),
  viewer: new Set<OpsCapability>(["overview.view", "overview.detail", "audit.view", "marketplace.view", "users.view", "feedback.view", "content.view"]),
};

export function can(role: OpsRole, capability: OpsCapability): boolean {
  return GRANTS[role].has(capability);
}

/**
 * Spec §3.2: an inactive user has no Ops role, root Owner included; an e-mail in ADMIN_EMAILS is the Owner whatever
 * its member row says; otherwise the member role, if any. `adminEmails` holds lower-cased addresses (auth/admin.ts).
 */
export function resolveRole(input: { userStatus: UserStatus; email: string; adminEmails: Set<string>; memberRole: GrantableRole | null }): OpsRole | null {
  if (input.userStatus !== "active") return null;
  if (input.adminEmails.has(input.email.trim().toLowerCase())) return "owner";
  return input.memberRole;
}

export interface OpsMember {
  userId: string;
  role: GrantableRole;
  grantedBy: string;
  grantedAt: string;
  updatedAt: string;
}

/** A member row with the member's e-mail, for the Team screen. */
export interface OpsMemberListing extends OpsMember {
  email: string;
}

/** An invitation lasts 7 days (Owner 2026-10-05). */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const OPS_INVITE_STATUSES = ["pending", "accepted", "cancelled", "expired"] as const;
export type OpsInviteStatus = (typeof OPS_INVITE_STATUSES)[number];
export type OpsInviteAction = "accept" | "cancel" | "expire";

export interface OpsInvite {
  id: string;
  email: string;
  role: GrantableRole;
  createdBy: string;
  status: OpsInviteStatus;
  expiresAt: string;
  acceptedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export function opsInviteExpiresAt(createdAt: string): string {
  return new Date(Date.parse(createdAt) + INVITE_TTL_MS).toISOString();
}

const INVITE_RULES: Record<OpsInviteAction, OpsInviteStatus> = { accept: "accepted", cancel: "cancelled", expire: "expired" };

/** pending → accepted | cancelled | expired. Every other move is refused. */
export function opsInviteTransition(status: OpsInviteStatus, action: OpsInviteAction): { ok: true; status: OpsInviteStatus } | { ok: false; error: "invalid_transition" } {
  return status === "pending" ? { ok: true, status: INVITE_RULES[action] } : { ok: false, error: "invalid_transition" };
}

/** Expired from the instant `expiresAt` is reached (same rule as builder invite codes and login tokens). */
export function isExpired(invite: Pick<OpsInvite, "expiresAt">, now: Date): boolean {
  return Date.parse(invite.expiresAt) <= now.getTime();
}
