import type { FlagKey } from "./flags.ts";

/** Linked accounts and how a session was created (ADR-012). Pure: no Hono, no D1. */

export const OAUTH_PROVIDERS = ["google", "github", "linkedin"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export function isOAuthProvider(value: unknown): value is OAuthProvider {
  return typeof value === "string" && (OAUTH_PROVIDERS as readonly string[]).includes(value);
}

/** The providers whose account a builder may show on the public profile (ADR-012 §5). Google never has a switch. */
export const BADGE_PROVIDERS = ["github", "linkedin"] as const;
export type BadgeProvider = (typeof BADGE_PROVIDERS)[number];
export function isBadgeProvider(value: unknown): value is BadgeProvider {
  return typeof value === "string" && (BADGE_PROVIDERS as readonly string[]).includes(value);
}

/** `sessions.method`: how the session was created. /ops and /admin accept only "magic_link" (ADR-012 §6). */
export const SESSION_METHODS = ["magic_link", "oauth_google", "oauth_github", "oauth_linkedin"] as const;
export type SessionMethod = (typeof SESSION_METHODS)[number];

export function isSessionMethod(value: unknown): value is SessionMethod {
  return typeof value === "string" && (SESSION_METHODS as readonly string[]).includes(value);
}

export function sessionMethodFor(provider: OAuthProvider): SessionMethod {
  return `oauth_${provider}`;
}

/**
 * Only a magic-link session reaches /ops and /admin (ADR-012 §6, plan decision 9). Called by the two guards, requireOps
 * and requireAdmin, and nowhere else: never from resolveOpsRole or the admin e-mail helper, which M7's isStaff also uses
 * to keep staff out of the statistics whatever way they signed in.
 */
export function isStaffSession(method: SessionMethod): boolean {
  return method === "magic_link";
}

/**
 * Only a magic-link session may start or finish linking a NEW provider account (ADR-013): adding a way to sign in must prove the mailbox.
 * Its own name and constant on purpose: today it equals `isStaffSession`, but that one is the /ops and /admin rule (decision 9) and the two may diverge.
 * Unlinking is allowed for every session and does not call this.
 */
export const LINK_SESSION_METHOD: SessionMethod = "magic_link";
export function isLinkCapableSession(method: SessionMethod): boolean {
  return method === LINK_SESSION_METHOD;
}

/** Each provider has its own feature flag: off hides the button and makes the callback 404 (ADR-012 §1). */
export const PROVIDER_FLAG: Record<OAuthProvider, FlagKey> = {
  google: "oauth_google",
  github: "oauth_github",
  linkedin: "oauth_linkedin",
};

/** Fixed display names; brand names are not translated (ADR-012, ADR-003). Also the `label` of an identity whose provider gave no e-mail (decision 12). */
export const PROVIDER_NAME: Record<OAuthProvider, string> = { google: "Google", github: "GitHub", linkedin: "LinkedIn" };

/** Audit actions of a link and an unlink. The row carries the provider only: no label, no subject, no token. */
export const IDENTITY_AUDIT = { link: "auth.identity.link", unlink: "auth.identity.unlink", show: "auth.identity.badge_show", hide: "auth.identity.badge_hide" } as const;

/** A GitHub login: letters, digits, hyphens and (Enterprise Managed Users, `name_SHORTCODE`) underscores, at most 39 characters. Stricter than the label CHECK, so it can never put `/`, `?` or `#` in a profile link. The one source: the GitHub adapter and the public badge both use it. */
export const GITHUB_LOGIN_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,38}$/;

/** The public profile link of a GitHub login, or null when the login is not a plain login (then no link and no badge is drawn). */
export function githubProfileUrl(login: string): string | null {
  return GITHUB_LOGIN_RE.test(login) ? `https://github.com/${login}` : null;
}

/** What the public profile may show of a linked account (ADR-012 §5). LinkedIn carries no label: it is often an e-mail. */
export type PublicBadge = { provider: "github"; login: string; url: string } | { provider: "linkedin" };

export interface UserIdentity {
  id: string;
  userId: string;
  provider: OAuthProvider;
  /** The provider's immutable id for the account. Never shown. */
  subject: string;
  /** E-mail (Google, LinkedIn) or login (GitHub). */
  label: string;
  showOnProfile: boolean;
  linkedAt: string;
  /** Null until the first sign-in with this identity. */
  lastUsedAt: string | null;
  updatedAt: string;
}

/** Why a link was refused. `already_linked` is the same user and the same provider account (nothing to do). `session_ended`: the session that asked to link is gone or is not a magic-link session (ADR-013). */
export type LinkRefusal = "already_linked" | "provider_account_taken" | "user_has_provider" | "session_ended";
