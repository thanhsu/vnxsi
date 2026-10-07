import { beforeEach, describe, expect, it } from "vitest";
import { FakeOAuthProvider, FAKE_CLIENT_ID, issueFakeCode, resetFakeOAuth } from "../../src/auth/oauth/fake.ts";
import { getOAuthProvider, isFakeOAuth, isProviderConfigured, oauthCredentials } from "../../src/auth/oauth/index.ts";
import { OidcClient } from "../../src/auth/oauth/oidc.ts";
import { OAUTH_PROVIDERS } from "../../src/domain/identity.ts";
import type { Bindings } from "../../src/env.ts";
import { testEnv } from "../helpers.ts";

const WRANGLER = import.meta.glob("../../wrangler.jsonc", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const ADAPTERS = import.meta.glob("../../src/auth/oauth/*.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

const NOW = Date.parse("2026-10-07T10:00:00.000Z");
const INPUT = { code: "", verifier: "v".repeat(43), nonce: "n".repeat(43), redirectUri: "https://vnx.si/auth/oauth/google/callback", now: NOW };
const withEnv = (over: Partial<Bindings>) => ({ ...testEnv, ...over }) as Bindings;
const REAL = { OAUTH_DRIVER: undefined, GOOGLE_CLIENT_ID: "gid", GOOGLE_CLIENT_SECRET: "gsecret", LINKEDIN_CLIENT_ID: "lid", LINKEDIN_CLIENT_SECRET: "lsecret" };

describe("test environment (decision 5)", () => {
  it("runs with the fake driver and no client credentials, so .dev.vars can never reach a real provider", () => {
    expect(testEnv.OAUTH_DRIVER).toBe("fake");
    for (const key of ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"] as const) expect(testEnv[key] ?? "", key).toBe("");
    expect(isFakeOAuth(testEnv)).toBe(true);
  });

  it("keeps the fake driver and every credential out of wrangler.jsonc", () => {
    const raw = WRANGLER["../../wrangler.jsonc"] ?? "";
    expect(raw.length).toBeGreaterThan(0);
    expect(raw).not.toContain("OAUTH_DRIVER");
    expect(raw).not.toMatch(/"(?:GOOGLE|GITHUB|LINKEDIN)_CLIENT_(?:ID|SECRET)"\s*:/);
  });

  it("lets only auth/oauth/index.ts import the fake provider (S1)", () => {
    const sources = import.meta.glob("../../src/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    expect(Object.keys(sources).length).toBeGreaterThan(50);
    for (const [file, src] of Object.entries(sources)) {
      if (file === "../../src/auth/oauth/index.ts") continue;
      const pattern = file.startsWith("../../src/auth/oauth/") ? /from\s+["']\.\/fake(?:\.ts)?["']/ : /from\s+["'][^"']*\/oauth\/fake(?:\.ts)?["']/;
      expect(src, file).not.toMatch(pattern);
    }
  });

  it("keeps adapters free of logging, Hono and the database (Review Focus 9)", () => {
    const files = Object.entries(ADAPTERS);
    expect(files.length).toBeGreaterThanOrEqual(4);
    for (const [file, src] of files) {
      expect(src, `${file} logs`).not.toMatch(/\bconsole\./);
      expect(src, `${file} imports hono`).not.toMatch(/from\s+["']hono/);
      expect(src, `${file} imports db`).not.toMatch(/from\s+["'][^"']*\/db\//);
    }
  });
});

describe("getOAuthProvider (decisions 5 and 6)", () => {
  it("returns the fake provider for every provider when the fake driver counts", () => {
    for (const provider of OAUTH_PROVIDERS) {
      const client = getOAuthProvider(testEnv, provider);
      expect(client, provider).toBeInstanceOf(FakeOAuthProvider);
      expect(client?.provider).toBe(provider);
      expect(client?.clientId).toBe(FAKE_CLIENT_ID);
      expect(isProviderConfigured(testEnv, provider)).toBe(true);
    }
  });

  it("ignores the fake driver once a real mail key exists (VNX-0803 F6), so production never gets the fake provider", () => {
    const env = withEnv({ ...REAL, OAUTH_DRIVER: "fake", RESEND_API_KEY: "re_live_key" });
    expect(isFakeOAuth(env)).toBe(false);
    expect(getOAuthProvider(env, "google")).toBeInstanceOf(OidcClient);
    const bare = withEnv({ OAUTH_DRIVER: "fake", RESEND_API_KEY: "re_live_key", GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "" });
    expect(getOAuthProvider(bare, "google")).toBeNull();
  });

  it("returns the real adapter for Google and LinkedIn when both credentials exist", () => {
    const env = withEnv(REAL);
    expect(getOAuthProvider(env, "google")).toMatchObject({ provider: "google", clientId: "gid" });
    expect(getOAuthProvider(env, "google")).toBeInstanceOf(OidcClient);
    expect(getOAuthProvider(env, "linkedin")).toMatchObject({ provider: "linkedin", clientId: "lid" });
    expect(isProviderConfigured(env, "google")).toBe(true);
  });

  it("treats a missing, empty or blank client id or secret as the provider being off", () => {
    for (const over of [{ GOOGLE_CLIENT_ID: undefined }, { GOOGLE_CLIENT_ID: "" }, { GOOGLE_CLIENT_ID: "   " }, { GOOGLE_CLIENT_SECRET: undefined }, { GOOGLE_CLIENT_SECRET: " " }]) {
      const env = withEnv({ ...REAL, ...over });
      expect(oauthCredentials(env, "google"), JSON.stringify(over)).toBeNull();
      expect(getOAuthProvider(env, "google")).toBeNull();
      expect(isProviderConfigured(env, "google")).toBe(false);
      expect(isProviderConfigured(env, "linkedin")).toBe(true);
    }
  });

  it("has no GitHub adapter yet (Task 4): GitHub is off outside the fake driver", () => {
    expect(getOAuthProvider(withEnv(REAL), "github")).toBeNull();
    expect(isProviderConfigured(withEnv(REAL), "github")).toBe(false);
  });

  it("passes the injected fetch to the real adapter", async () => {
    const calls: string[] = [];
    const fn = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response("{}", { status: 500 });
    }) as typeof fetch;
    const client = getOAuthProvider(withEnv(REAL), "google", fn);
    expect(await client?.exchange({ ...INPUT, code: "c" })).toEqual({ ok: false, reason: "token_request" });
    expect(calls).toEqual(["https://oauth2.googleapis.com/token"]);
  });
});

describe("FakeOAuthProvider (decision 5, S2)", () => {
  beforeEach(() => resetFakeOAuth());
  const identity = { subject: "fake-sub", label: "lan@example.com" };
  const EXPECT = { verifier: INPUT.verifier, nonce: INPUT.nonce, redirectUri: INPUT.redirectUri };

  it("trades an issued code for the identity it was issued for", async () => {
    const code = issueFakeCode("google", identity, EXPECT);
    const result = await new FakeOAuthProvider("google").exchange({ ...INPUT, code });
    expect(result).toEqual({ ok: true, identity });
  });

  it("works across new client instances in the same isolate, like one request after another", async () => {
    const code = issueFakeCode("linkedin", identity, EXPECT);
    expect((await getOAuthProvider(testEnv, "linkedin")?.exchange({ ...INPUT, code }))?.ok).toBe(true);
  });

  it("rejects a reused code (S2), and an unknown one", async () => {
    const code = issueFakeCode("github", identity, EXPECT);
    const fake = new FakeOAuthProvider("github");
    expect((await fake.exchange({ ...INPUT, code })).ok).toBe(true);
    expect(await fake.exchange({ ...INPUT, code })).toEqual({ ok: false, reason: "token_request" });
    expect(await fake.exchange({ ...INPUT, code: "fake-code-unknown" })).toEqual({ ok: false, reason: "token_request" });
  });

  it("burns a code even when the attempt was wrong, and refuses another provider's code", async () => {
    const code = issueFakeCode("google", identity, EXPECT);
    expect(await new FakeOAuthProvider("github").exchange({ ...INPUT, code })).toEqual({ ok: false, reason: "token_request" });
    expect(await new FakeOAuthProvider("google").exchange({ ...INPUT, code })).toEqual({ ok: false, reason: "token_request" });
  });

  it("enforces the verifier, redirect URI and nonce a test says the flow must present", async () => {
    const ok = issueFakeCode("google", identity, EXPECT);
    expect((await new FakeOAuthProvider("google").exchange({ ...INPUT, code: ok })).ok).toBe(true);
    const badVerifier = issueFakeCode("google", identity, EXPECT);
    expect(await new FakeOAuthProvider("google").exchange({ ...INPUT, code: badVerifier, verifier: "w".repeat(43) })).toEqual({ ok: false, reason: "token_request" });
    const badRedirect = issueFakeCode("google", identity, EXPECT);
    expect(await new FakeOAuthProvider("google").exchange({ ...INPUT, code: badRedirect, redirectUri: "https://evil.example/cb" })).toEqual({ ok: false, reason: "token_request" });
    const badNonce = issueFakeCode("google", identity, EXPECT);
    expect(await new FakeOAuthProvider("google").exchange({ ...INPUT, code: badNonce, nonce: "m".repeat(43) })).toEqual({ ok: false, reason: "id_token_nonce" });
  });

  it("returns a copy of the identity and nothing that looks like a token", async () => {
    const code = issueFakeCode("google", identity, EXPECT);
    const result = await new FakeOAuthProvider("google").exchange({ ...INPUT, code });
    if (!result.ok) throw new Error(result.reason);
    expect(Object.keys(result.identity).sort()).toEqual(["label", "subject"]);
    result.identity.label = "changed";
    expect(identity.label).toBe("lan@example.com");
  });
});
