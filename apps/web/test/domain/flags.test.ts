import { describe, expect, it } from "vitest";
import { FLAG_CACHE_TTL_MS, FLAG_KEYS, isFlagKey } from "../../src/domain/flags.ts";

describe("feature flag keys (addendum §3.1)", () => {
  it("are the seven keys of the addendum, then one per OAuth provider (ADR-012), in order", () => {
    expect([...FLAG_KEYS]).toEqual([
      "affiliate", "partner_referral", "sponsored_listings", "ads", "lead_generation", "ai_content", "content_indexing",
      "oauth_google", "oauth_github", "oauth_linkedin",
    ]);
  });

  it("recognises only those keys", () => {
    for (const key of FLAG_KEYS) expect(isFlagKey(key)).toBe(true);
    for (const bad of ["Affiliate", "affiliate ", "", "unknown", "__proto__", "constructor", 1, null, undefined]) expect(isFlagKey(bad), String(bad)).toBe(false);
  });

  it("caches for 60 seconds", () => {
    expect(FLAG_CACHE_TTL_MS).toBe(60_000);
  });
});
