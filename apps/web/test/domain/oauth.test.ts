import { describe, expect, it } from "vitest";
import {
  base64UrlDecode,
  base64UrlEncode,
  buildAuthorizeUrl,
  checkCallbackState,
  codeChallengeS256,
  encodeOAuthCookie,
  flowMatchesSession,
  generateNonce,
  generateState,
  generateVerifier,
  LINK_INTENT_TTL_MS,
  newFlowCookie,
  newLinkIntent,
  OAUTH_FLOW_TTL_MS,
  OAUTH_PROVIDER_SPECS,
  oauthRedirectUri,
  parseOAuthCookie,
  resolveStartIntent,
  timingSafeEqualText,
  verifyIdToken,
} from "../../src/domain/oauth.ts";
import type { OAuthProvider } from "../../src/domain/identity.ts";

const NOW = Date.parse("2026-10-07T10:00:00.000Z");
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

describe("PKCE and random values (RFC 7636, ADR-012 §1)", () => {
  it("derives the S256 challenge of the RFC 7636 appendix B verifier", async () => {
    expect(await codeChallengeS256("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("generates 43-character URL-safe values that never repeat", async () => {
    const seen = new Set<string>();
    for (const make of [generateState, generateNonce, generateVerifier, generateState, generateNonce, generateVerifier]) {
      const value = make();
      expect(value).toMatch(TOKEN);
      seen.add(value);
    }
    expect(seen.size).toBe(6);
    expect(await codeChallengeS256(generateVerifier())).toMatch(TOKEN);
  });

  it("round-trips base64url and refuses text outside the alphabet", () => {
    const bytes = new Uint8Array([0, 250, 251, 252, 253, 254, 255]);
    expect([...(base64UrlDecode(base64UrlEncode(bytes)) ?? [])]).toEqual([...bytes]);
    for (const bad of ["a+b", "a/b", "a=b", "a b", "a", "é"]) expect(base64UrlDecode(bad), bad).toBeNull();
  });
});

describe("timingSafeEqualText (decision 2, R2)", () => {
  it("is true only for identical text, and false for any difference in content or length", () => {
    expect(timingSafeEqualText("abc", "abc")).toBe(true);
    expect(timingSafeEqualText("", "")).toBe(true);
    for (const [a, b] of [["abc", "abd"], ["abc", "ab"], ["ab", "abc"], ["abc", ""], ["é", "e"]] as const) expect(timingSafeEqualText(a, b), `${a}|${b}`).toBe(false);
  });
});

describe("providers and the authorize URL (ADR-012 §1)", () => {
  it("fixes scopes and issuers per provider", () => {
    expect(OAUTH_PROVIDER_SPECS.google).toMatchObject({ scope: "openid email", oidc: true, issuers: ["https://accounts.google.com", "accounts.google.com"] });
    expect(OAUTH_PROVIDER_SPECS.linkedin).toMatchObject({ scope: "openid profile email", oidc: true, issuers: ["https://www.linkedin.com/oauth"] });
    expect(OAUTH_PROVIDER_SPECS.github).toMatchObject({ scope: "", oidc: false, issuers: [] });
  });

  it("builds the callback URI from APP_ORIGIN only, with no locale prefix", () => {
    expect(oauthRedirectUri("https://vnx.si", "google")).toBe("https://vnx.si/auth/oauth/google/callback");
    expect(oauthRedirectUri("https://vnx.si/some/path?x=1", "github")).toBe("https://vnx.si/auth/oauth/github/callback");
  });

  const input = { clientId: "client-1", redirectUri: "https://vnx.si/auth/oauth/google/callback", state: "s".repeat(43), challenge: "c".repeat(43), nonce: "n".repeat(43) };

  it("builds a Google URL with PKCE S256, state, nonce and exactly the known parameters", () => {
    const url = new URL(buildAuthorizeUrl({ provider: "google", ...input }));
    expect(`${url.origin}${url.pathname}`).toBe(OAUTH_PROVIDER_SPECS.google.authorizeUrl);
    expect([...url.searchParams.keys()].sort()).toEqual(["client_id", "code_challenge", "code_challenge_method", "nonce", "redirect_uri", "response_type", "scope", "state"]);
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      response_type: "code",
      client_id: "client-1",
      redirect_uri: input.redirectUri,
      scope: "openid email",
      state: input.state,
      code_challenge: input.challenge,
      code_challenge_method: "S256",
      nonce: input.nonce,
    });
  });

  it("asks GitHub for no scope and no nonce, and LinkedIn for openid profile email", () => {
    const github = new URL(buildAuthorizeUrl({ provider: "github", ...input }));
    expect(github.searchParams.has("scope")).toBe(false);
    expect(github.searchParams.has("nonce")).toBe(false);
    expect(github.searchParams.get("code_challenge_method")).toBe("S256");
    const linkedin = new URL(buildAuthorizeUrl({ provider: "linkedin", ...input }));
    expect(linkedin.searchParams.get("scope")).toBe("openid profile email");
    expect(linkedin.searchParams.get("nonce")).toBe(input.nonce);
  });
});

const enc = (value: unknown) => base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
const idToken = (claims: unknown, signature = "c2ln") => `${enc({ alg: "RS256", typ: "JWT" })}.${enc(claims)}.${signature}`;
const NONCE = "n".repeat(43);
const GOOD = { iss: "https://accounts.google.com", aud: "client-1", azp: "client-1", sub: "1122334455", exp: NOW / 1000 + 600, nonce: NONCE, email: "lan@example.com", name: "Lan Nguyen" };
const EXPECTED = { issuers: OAUTH_PROVIDER_SPECS.google.issuers, audience: "client-1", nonce: NONCE, now: NOW };
const reason = (claims: unknown, expected = EXPECTED) => {
  const result = verifyIdToken(idToken(claims), expected);
  return result.ok ? "ok" : result.reason;
};

describe("verifyIdToken (ADR-012 §1, decision 3 (c) and (d))", () => {
  it("returns only the subject and the e-mail, never the name", () => {
    expect(verifyIdToken(idToken(GOOD), EXPECTED)).toEqual({ ok: true, claims: { subject: "1122334455", email: "lan@example.com" } });
  });

  it("accepts both Google issuer spellings and a token with no azp and a single audience", () => {
    expect(reason({ ...GOOD, iss: "accounts.google.com" })).toBe("ok");
    const { azp: _azp, ...noAzp } = GOOD;
    expect(reason(noAzp)).toBe("ok");
    expect(reason({ ...GOOD, aud: ["client-1"] })).toBe("ok");
  });

  it("gives a missing, empty or over-long e-mail as null instead of failing", () => {
    for (const email of [undefined, "", "x".repeat(255), 42]) {
      const result = verifyIdToken(idToken({ ...GOOD, email }), EXPECTED);
      expect(result, String(email)).toEqual({ ok: true, claims: { subject: "1122334455", email: null } });
    }
  });

  it("refuses any issuer that is not exactly listed", () => {
    for (const iss of ["https://evil.example", "https://accounts.google.com/", "https://accounts.google.com.evil.example", "http://accounts.google.com", "ACCOUNTS.GOOGLE.COM", "", 7, undefined]) {
      expect(reason({ ...GOOD, iss }), String(iss)).toBe("issuer");
    }
    // LinkedIn's issuer is not Google's, and GitHub (no issuers) accepts nothing.
    expect(reason(GOOD, { ...EXPECTED, issuers: OAUTH_PROVIDER_SPECS.linkedin.issuers })).toBe("issuer");
    expect(reason(GOOD, { ...EXPECTED, issuers: OAUTH_PROVIDER_SPECS.github.issuers })).toBe("issuer");
  });

  it("requires aud to contain the client id, and azp, when present, to equal it", () => {
    expect(reason({ ...GOOD, aud: "other-client" })).toBe("audience");
    expect(reason({ ...GOOD, aud: ["other-client", "third"] })).toBe("audience");
    expect(reason({ ...GOOD, aud: undefined })).toBe("audience");
    expect(reason({ ...GOOD, azp: "other-client" })).toBe("azp");
    expect(reason({ ...GOOD, azp: 5 })).toBe("azp");
    const { azp: _azp, ...noAzp } = GOOD;
    expect(reason({ ...noAzp, aud: ["client-1", "other-client"] })).toBe("azp");
    expect(reason({ ...GOOD, aud: ["client-1", "other-client"] })).toBe("ok");
  });

  it("refuses an expired token with 60 seconds of clock tolerance", () => {
    expect(reason({ ...GOOD, exp: NOW / 1000 - 30 })).toBe("ok");
    expect(reason({ ...GOOD, exp: NOW / 1000 - 61 })).toBe("expired");
    // The boundary: exp + 60 s equal to now is already expired (M3).
    expect(reason({ ...GOOD, exp: NOW / 1000 - 60 })).toBe("expired");
    expect(reason({ ...GOOD, exp: NOW / 1000 - 59 })).toBe("ok");
    for (const exp of [undefined, "9999999999", null]) expect(reason({ ...GOOD, exp }), String(exp)).toBe("expired");
  });

  it("refuses a missing or different nonce", () => {
    expect(reason({ ...GOOD, nonce: "m".repeat(43) })).toBe("nonce");
    expect(reason({ ...GOOD, nonce: NONCE.slice(1) })).toBe("nonce");
    expect(reason({ ...GOOD, nonce: undefined })).toBe("nonce");
    expect(reason({ ...GOOD, nonce: 123 })).toBe("nonce");
  });

  it("refuses a missing, empty or over-long subject", () => {
    for (const sub of [undefined, "", "s".repeat(256), 12345, null]) expect(reason({ ...GOOD, sub }), String(sub)).toBe("subject");
    expect(reason({ ...GOOD, sub: "s".repeat(255) })).toBe("ok");
  });

  it("refuses text that is not a three-part token with a JSON object payload", () => {
    const notJson = base64UrlEncode(new TextEncoder().encode("not json"));
    for (const bad of ["", "a.b", "a.b.c.d", `${enc({})}.!!!.sig`, `${enc({})}.${notJson}.sig`, `${enc({})}.${enc([1, 2])}.sig`, `${enc({})}.${enc("text")}.sig`]) {
      expect(verifyIdToken(bad, EXPECTED), bad).toEqual({ ok: false, reason: "malformed" });
    }
  });

  it("fails closed when the expected client id or nonce is empty", () => {
    expect(reason({ ...GOOD, aud: "" }, { ...EXPECTED, audience: "" })).toBe("malformed");
    expect(reason({ ...GOOD, nonce: "" }, { ...EXPECTED, nonce: "" })).toBe("malformed");
  });

  it("does not check the signature (decision 3, approved deviation R1): the token comes from the token endpoint over TLS", () => {
    expect(verifyIdToken(idToken(GOOD, "AAAA"), EXPECTED).ok).toBe(true);
  });
});

describe("the state cookie (ADR-012 §1, decision 4)", () => {
  const flow = (over: Partial<Parameters<typeof newFlowCookie>[0]> = {}) =>
    newFlowCookie(
      { provider: "google", intent: "signin", state: generateState(), verifier: generateVerifier(), nonce: generateNonce(), next: "/hub", locale: "vi", sessionHash: null, ...over },
      NOW,
    );
  const parse = (raw: string, provider: OAuthProvider = "google", now = NOW) => parseOAuthCookie(raw, { provider, now });

  it("sets the lifetimes: 10 minutes for a flow, 2 minutes for a link intent", () => {
    expect(OAUTH_FLOW_TTL_MS).toBe(600_000);
    expect(LINK_INTENT_TTL_MS).toBe(120_000);
    expect(flow().exp).toBe(NOW + 600_000);
    expect(newLinkIntent({ provider: "github", sessionHash: HASH_A }, NOW).exp).toBe(NOW + 120_000);
  });

  it("round-trips a signin flow, a link flow and a link intent", () => {
    const signin = flow();
    expect(parse(encodeOAuthCookie(signin))).toEqual(signin);
    const link = flow({ intent: "link", sessionHash: HASH_A, next: null, locale: "zh-Hant" });
    expect(parse(encodeOAuthCookie(link))).toEqual(link);
    const intent = newLinkIntent({ provider: "linkedin", sessionHash: HASH_B }, NOW);
    expect(parse(encodeOAuthCookie(intent), "linkedin")).toEqual(intent);
  });

  it("refuses a cookie written for another provider (F5)", () => {
    expect(parse(encodeOAuthCookie(flow()), "github")).toBeNull();
    expect(parse(encodeOAuthCookie(newLinkIntent({ provider: "github", sessionHash: HASH_A }, NOW)))).toBeNull();
  });

  it("refuses an expired cookie, and one whose exp is further away than its lifetime allows", () => {
    expect(parse(encodeOAuthCookie(flow()), "google", NOW + 600_000)).toBeNull();
    expect(parse(encodeOAuthCookie(flow()), "google", NOW + 599_999)).not.toBeNull();
    expect(parse(enc({ ...flow(), exp: NOW + 600_001 }))).toBeNull();
    const intent = newLinkIntent({ provider: "google", sessionHash: HASH_A }, NOW);
    expect(parse(enc({ ...intent, exp: NOW + 120_001 }))).toBeNull();
    expect(parse(enc({ ...flow(), exp: "soon" }))).toBeNull();
  });

  it("refuses anything that is not a well-shaped cookie", () => {
    const good = { ...flow() };
    const intent = newLinkIntent({ provider: "google", sessionHash: HASH_A }, NOW);
    const bad: unknown[] = [
      { ...good, v: 2 },
      { ...good, phase: "other" },
      { ...good, state: "short" },
      { ...good, state: `${"s".repeat(42)}+` },
      { ...good, verifier: "v".repeat(129) },
      { ...good, nonce: undefined },
      { ...good, intent: "admin" },
      { ...good, locale: "fr" },
      { ...good, next: 5 },
      { ...good, next: `/${"x".repeat(512)}` },
      { ...good, next: "//evil.example" }, // LOW-1: next must be a same-site path
      { ...good, next: "https://evil.example" },
      { ...good, next: "/\\evil.example" },
      { ...good, sessionHash: HASH_A }, // a signin flow carries no session
      { ...good, intent: "link", sessionHash: null }, // a link flow needs one
      { ...good, intent: "link", sessionHash: "not-a-hash" },
      { ...intent, intent: "signin" },
      { ...intent, sessionHash: "A".repeat(64) },
      [],
      "text",
      5,
    ];
    for (const value of bad) expect(parse(enc(value)), JSON.stringify(value)).toBeNull();
    for (const raw of [undefined, null, "", "not base64 !", "e30", base64UrlEncode(new TextEncoder().encode("{bad json")), "A".repeat(2049)]) {
      expect(parseOAuthCookie(raw, { provider: "google", now: NOW }), String(raw)).toBeNull();
    }
  });

  it("writes only a next the parser accepts: any other value becomes null (M1)", () => {
    for (const next of ["//evil.example", "https://evil.example", "/\\evil.example", "/café", "/a\nb", ""]) {
      const cookie = flow({ next });
      expect(cookie.next, next).toBeNull();
      expect(parse(encodeOAuthCookie(cookie)), next).toEqual(cookie);
    }
    expect(flow({ next: "/hub?x=1" }).next).toBe("/hub?x=1");
  });

  it("drops a next that is too long instead of storing it, and refuses to build an inconsistent flow", () => {
    expect(flow({ next: `/${"x".repeat(600)}` }).next).toBeNull();
    expect(() => flow({ intent: "link", sessionHash: null })).toThrow();
    expect(() => flow({ intent: "signin", sessionHash: HASH_A })).toThrow();
  });
});

describe("start and callback decisions (ADR-012 §3, §4)", () => {
  const intent = newLinkIntent({ provider: "google", sessionHash: HASH_A }, NOW);
  const make = (kind: "signin" | "link") =>
    newFlowCookie({ provider: "google", intent: kind, state: "s".repeat(43), verifier: "v".repeat(43), nonce: "n".repeat(43), next: null, locale: "en", sessionHash: kind === "link" ? HASH_A : null }, NOW);
  const flow = make("signin");
  const linkFlow = make("link");

  it("starts a link only for a live intent cookie whose session hash matches the current session", () => {
    expect(resolveStartIntent(intent, HASH_A, NOW)).toBe("link");
    expect(resolveStartIntent(intent, HASH_B, NOW)).toBe("signin");
    expect(resolveStartIntent(intent, null, NOW)).toBe("signin");
    expect(resolveStartIntent(intent, HASH_A, NOW + LINK_INTENT_TTL_MS)).toBe("signin");
    expect(resolveStartIntent(null, HASH_A, NOW)).toBe("signin");
    // A flow cookie (a start that already ran) never turns into a link by itself.
    expect(resolveStartIntent(linkFlow, HASH_A, NOW)).toBe("signin");
  });

  it("accepts a callback only for a flow cookie whose state equals the state parameter", () => {
    expect(checkCallbackState(flow, "s".repeat(43))).toEqual({ ok: true, flow });
    expect(checkCallbackState(flow, "t".repeat(43))).toEqual({ ok: false, reason: "state_mismatch" });
    for (const state of [null, undefined, "", "s".repeat(42), "s".repeat(44)]) expect(checkCallbackState(flow, state), String(state)).toEqual({ ok: false, reason: "state_mismatch" });
    expect(checkCallbackState(null, "s".repeat(43))).toEqual({ ok: false, reason: "no_cookie" });
    expect(checkCallbackState(intent, "s".repeat(43))).toEqual({ ok: false, reason: "wrong_phase" });
  });

  it("lets a signin flow through and a link flow only for the same session", () => {
    expect(flowMatchesSession(flow, null)).toBe(true);
    expect(flowMatchesSession(linkFlow, HASH_A)).toBe(true);
    expect(flowMatchesSession(linkFlow, HASH_B)).toBe(false);
    expect(flowMatchesSession(linkFlow, null)).toBe(false);
  });
});
