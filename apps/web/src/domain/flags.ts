/** Feature flags (monetization addendum §3.1). Pure: no Hono, no D1. */

/** Every valid flag. A flag with no row in `feature_flags` is off. */
export const FLAG_KEYS = ["affiliate", "partner_referral", "sponsored_listings", "ads", "lead_generation", "ai_content", "content_indexing"] as const;

export type FlagKey = (typeof FLAG_KEYS)[number];
export type FlagState = Record<FlagKey, boolean>;

/** How long one isolate may serve a flag value it has read (addendum §3.1). */
export const FLAG_CACHE_TTL_MS = 60_000;

export function isFlagKey(value: unknown): value is FlagKey {
  return typeof value === "string" && (FLAG_KEYS as readonly string[]).includes(value);
}
