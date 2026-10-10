import { describe, expect, it } from "vitest";
import { FLAG_KEYS } from "../../src/domain/flags.ts";
import { BADGE_PROVIDERS, IDENTITY_AUDIT, isBadgeProvider, isOAuthProvider, isSessionMethod, OAUTH_PROVIDERS, PROVIDER_FLAG, PROVIDER_NAME, SESSION_METHODS, sessionMethodFor } from "../../src/domain/identity.ts";

describe("OAuth providers (ADR-012 §1)", () => {
  it("are google, github and linkedin, in that order", () => {
    expect([...OAUTH_PROVIDERS]).toEqual(["google", "github", "linkedin"]);
  });

  it("recognises only those", () => {
    for (const p of OAUTH_PROVIDERS) expect(isOAuthProvider(p)).toBe(true);
    for (const bad of ["Google", "google ", "", "twitter", "magic_link", "__proto__", "constructor", 1, null, undefined]) expect(isOAuthProvider(bad), String(bad)).toBe(false);
  });

  it("each has its own feature flag, and that flag is a real one", () => {
    expect(Object.keys(PROVIDER_FLAG)).toEqual([...OAUTH_PROVIDERS]);
    expect(PROVIDER_FLAG).toEqual({ google: "oauth_google", github: "oauth_github", linkedin: "oauth_linkedin" });
    for (const flag of Object.values(PROVIDER_FLAG)) expect(FLAG_KEYS).toContain(flag);
    expect(new Set(Object.values(PROVIDER_FLAG)).size).toBe(3);
  });
});

describe("session methods (ADR-012 §2)", () => {
  it("are magic_link plus one per provider", () => {
    expect([...SESSION_METHODS]).toEqual(["magic_link", "oauth_google", "oauth_github", "oauth_linkedin"]);
  });

  it("maps a provider to its method, and never to magic_link", () => {
    expect(OAUTH_PROVIDERS.map(sessionMethodFor)).toEqual(["oauth_google", "oauth_github", "oauth_linkedin"]);
  });

  it("recognises only those", () => {
    for (const m of SESSION_METHODS) expect(isSessionMethod(m)).toBe(true);
    for (const bad of ["oauth", "oauth_twitter", "MAGIC_LINK", "", "__proto__", 0, null, undefined]) expect(isSessionMethod(bad), String(bad)).toBe(false);
  });
});

describe("identity audit actions (ADR-012 §4)", () => {
  it("are fixed", () => {
    expect(IDENTITY_AUDIT).toEqual({ link: "auth.identity.link", unlink: "auth.identity.unlink", show: "auth.identity.badge_show", hide: "auth.identity.badge_hide" });
  });
});

describe("provider display names (ADR-012 decision 12, F2)", () => {
  it("are fixed and never translated", () => {
    expect(PROVIDER_NAME).toEqual({ google: "Google", github: "GitHub", linkedin: "LinkedIn" });
    expect(Object.keys(PROVIDER_NAME)).toEqual([...OAUTH_PROVIDERS]);
  });
});

describe("badge providers (VNX-2606a)", () => {
  it("are exactly github and linkedin: google never", () => {
    expect([...BADGE_PROVIDERS]).toEqual(["github", "linkedin"]);
    expect(isBadgeProvider("github")).toBe(true);
    expect(isBadgeProvider("linkedin")).toBe(true);
    for (const v of ["google", "GitHub", "", null, 3]) expect(isBadgeProvider(v)).toBe(false);
  });
});
