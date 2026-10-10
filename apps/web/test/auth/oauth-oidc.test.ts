import { describe, expect, it, vi } from "vitest";
import { OIDC_TOKEN_URLS, OidcClient, type OidcProvider } from "../../src/auth/oauth/oidc.ts";
import { linkIdentity } from "../../src/db/identities.ts";
import { PROVIDER_NAME } from "../../src/domain/identity.ts";
import { base64UrlEncode, OAUTH_PROVIDER_SPECS } from "../../src/domain/oauth.ts";
import { ensureUser } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const NOW = Date.parse("2026-10-07T10:00:00.000Z");
const NONCE = "n".repeat(43);
const PROVIDERS: OidcProvider[] = ["google", "linkedin"];
const INPUT = { code: "auth-code", verifier: "v".repeat(43), nonce: NONCE, redirectUri: "https://vnx.si/auth/oauth/google/callback", now: NOW };

const enc = (value: unknown) => base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
const claimsFor = (provider: OidcProvider, over: Record<string, unknown> = {}) => ({
  iss: OAUTH_PROVIDER_SPECS[provider].issuers[0],
  aud: "client-id",
  sub: "sub-1",
  exp: NOW / 1000 + 600,
  nonce: NONCE,
  email: "lan@example.com",
  name: "Lan Nguyen",
  ...over,
});
const idToken = (claims: unknown) => `${enc({ alg: "RS256", typ: "JWT" })}.${enc(claims)}.c2ln`;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const tokenJson = (claims: unknown) => ({ access_token: "ya29.SECRET-ACCESS", refresh_token: "1//SECRET-REFRESH", token_type: "Bearer", expires_in: 3599, id_token: idToken(claims) });

type Call = { url: string; init: RequestInit };
function stubFetch(respond: () => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    return respond();
  }) as typeof fetch;
  return { fn, calls };
}
const client = (provider: OidcProvider, fn: typeof fetch) => new OidcClient(provider, "client-id", "client-secret", fn);

describe("OidcClient token request (decision 3 (a), (b))", () => {
  it("posts the code exchange to the constant token URL, without following redirects", async () => {
    expect(OIDC_TOKEN_URLS).toEqual({ google: "https://oauth2.googleapis.com/token", linkedin: "https://www.linkedin.com/oauth/v2/accessToken" });
    for (const provider of PROVIDERS) {
      const { fn, calls } = stubFetch(() => json(tokenJson(claimsFor(provider))));
      await client(provider, fn).exchange(INPUT);
      expect(calls, provider).toHaveLength(1);
      const [call] = calls;
      expect(call?.url).toBe(OIDC_TOKEN_URLS[provider]);
      expect(call?.init.method).toBe("POST");
      expect(call?.init.redirect).toBe("manual");
      expect(call?.init.signal).toBeInstanceOf(AbortSignal);
      expect(Object.fromEntries(new URLSearchParams(String(call?.init.body)))).toEqual({
        grant_type: "authorization_code",
        code: "auth-code",
        redirect_uri: INPUT.redirectUri,
        client_id: "client-id",
        client_secret: "client-secret",
        code_verifier: INPUT.verifier,
      });
    }
  });

  it("takes the ID token only from the token endpoint JSON, whatever else the input carries", async () => {
    const forged = idToken(claimsFor("google"));
    const { fn } = stubFetch(() => json({ access_token: "a", token_type: "Bearer" }));
    const result = await client("google", fn).exchange({ ...INPUT, idToken: forged } as never);
    expect(result).toEqual({ ok: false, reason: "token_response" });
  });
});

describe("OidcClient redirects and runtime options (F1)", () => {
  it("treats any redirect from the token endpoint as a failed request, and calls fetch once (workerd supports manual, not error)", async () => {
    for (const status of [301, 302, 307]) {
      const { fn, calls } = stubFetch(() => new Response(null, { status, headers: { location: "https://evil.example/token" } }));
      expect(await client("google", fn).exchange(INPUT), String(status)).toEqual({ ok: false, reason: "token_request" });
      expect(calls, String(status)).toHaveLength(1);
    }
  });

  it("builds options the workerd runtime accepts: a Request made from the captured call does not throw", async () => {
    for (const provider of PROVIDERS) {
      const { fn, calls } = stubFetch(() => json(tokenJson(claimsFor(provider))));
      await client(provider, fn).exchange(INPUT);
      const call = calls[0];
      expect(call, provider).toBeDefined();
      expect(() => new Request(call?.url ?? "", call?.init), provider).not.toThrow();
      expect(new Request(call?.url ?? "", call?.init).redirect, provider).toBe("manual");
    }
  });
});

describe("OidcClient result (ADR-012 §1, decision 12, F2)", () => {
  it("returns the subject and the e-mail as label, and nothing else: no token, no name", async () => {
    for (const provider of PROVIDERS) {
      const { fn } = stubFetch(() => json(tokenJson(claimsFor(provider))));
      const result = await client(provider, fn).exchange(INPUT);
      expect(result, provider).toEqual({ ok: true, identity: { subject: "sub-1", label: "lan@example.com" } });
      const text = JSON.stringify(result);
      for (const secret of ["SECRET", "Lan Nguyen", "auth-code", "client-secret"]) expect(text, `${provider} ${secret}`).not.toContain(secret);
    }
  });

  it("falls back to the fixed provider name when there is no e-mail, never to the name claim", async () => {
    for (const provider of PROVIDERS) {
      const { fn } = stubFetch(() => json(tokenJson(claimsFor(provider, { email: undefined }))));
      const result = await client(provider, fn).exchange(INPUT);
      expect(result, provider).toEqual({ ok: true, identity: { subject: "sub-1", label: PROVIDER_NAME[provider] } });
    }
  });

  it("always gives a label the database accepts (1-254 characters)", async () => {
    const user = await ensureUser("oidc-label@vnx.si");
    for (const [provider, email] of [["google", "x".repeat(254)], ["linkedin", undefined]] as const) {
      const { fn } = stubFetch(() => json(tokenJson(claimsFor(provider, { email, sub: `label-${provider}` }))));
      const result = await client(provider, fn).exchange(INPUT);
      if (!result.ok) throw new Error(result.reason);
      expect(result.identity.label.length).toBeGreaterThanOrEqual(1);
      expect(result.identity.label.length).toBeLessThanOrEqual(254);
      expect((await linkIdentity(testEnv.DB, { userId: user.id, provider, subject: result.identity.subject, label: result.identity.label, now: "2026-10-07T10:00:00.000Z" })).ok).toBe(true);
    }
  });
});

describe("OidcClient failures give fixed codes", () => {
  it("maps a failed or non-2xx token request to token_request", async () => {
    const cases: Array<() => Response | Promise<Response>> = [() => json({ error: "invalid_grant" }, 400), () => json({}, 500), () => { throw new TypeError("network failure"); }];
    for (const respond of cases) {
      const { fn } = stubFetch(respond);
      expect(await client("google", fn).exchange(INPUT)).toEqual({ ok: false, reason: "token_request" });
    }
  });

  it("maps an unreadable or incomplete token response to token_response", async () => {
    const cases: Array<() => Response> = [
      () => new Response("not json", { status: 200 }),
      () => json([1, 2]),
      () => json({ id_token: 5 }),
      () => json({ access_token: "a" }),
    ];
    for (const respond of cases) {
      const { fn } = stubFetch(respond);
      expect(await client("linkedin", fn).exchange(INPUT)).toEqual({ ok: false, reason: "token_response" });
    }
  });

  it("maps every claim defect to id_token_<reason>, for each provider", async () => {
    const table: Array<[Record<string, unknown>, string]> = [
      [{ iss: "https://evil.example" }, "id_token_issuer"],
      [{ aud: "other-client" }, "id_token_audience"],
      [{ azp: "other-client" }, "id_token_azp"],
      [{ exp: NOW / 1000 - 120 }, "id_token_expired"],
      [{ nonce: "m".repeat(43) }, "id_token_nonce"],
      [{ sub: "" }, "id_token_subject"],
    ];
    for (const provider of PROVIDERS) {
      for (const [over, reason] of table) {
        const { fn } = stubFetch(() => json(tokenJson(claimsFor(provider, over))));
        expect(await client(provider, fn).exchange(INPUT), `${provider} ${reason}`).toEqual({ ok: false, reason });
      }
    }
  });

  it("accepts only the issuer of its own provider", async () => {
    const google = stubFetch(() => json(tokenJson(claimsFor("linkedin"))));
    expect(await client("google", google.fn).exchange(INPUT)).toEqual({ ok: false, reason: "id_token_issuer" });
    const linkedin = stubFetch(() => json(tokenJson(claimsFor("google"))));
    expect(await client("linkedin", linkedin.fn).exchange(INPUT)).toEqual({ ok: false, reason: "id_token_issuer" });
    const alt = stubFetch(() => json(tokenJson(claimsFor("google", { iss: "accounts.google.com" }))));
    expect((await client("google", alt.fn).exchange(INPUT)).ok).toBe(true);
  });

  it("logs nothing on success or failure (Review Focus 9)", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => undefined));
    try {
      for (const respond of [() => json(tokenJson(claimsFor("google"))), () => json({}, 500), () => new Response("x"), () => json(tokenJson(claimsFor("google", { nonce: "bad" })))]) {
        await client("google", stubFetch(respond).fn).exchange(INPUT);
      }
      for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });
});
