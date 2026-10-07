import { describe, expect, it } from "vitest";
import { FLAG_KEYS } from "../../src/domain/flags.ts";
import { IDENTITY_AUDIT, isOAuthProvider, isSessionMethod, OAUTH_PROVIDERS, PROVIDER_FLAG, SESSION_METHODS, sessionMethodFor } from "../../src/domain/identity.ts";

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
    expect(IDENTITY_AUDIT).toEqual({ link: "auth.identity.link", unlink: "auth.identity.unlink" });
  });
});
