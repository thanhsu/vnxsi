import { describe, expect, it, vi } from "vitest";
import { GITHUB_TOKEN_URL, GITHUB_USER_URL, GithubClient } from "../../src/auth/oauth/github.ts";
import { getOAuthProvider } from "../../src/auth/oauth/index.ts";
import { linkIdentity } from "../../src/db/identities.ts";
import type { Bindings } from "../../src/env.ts";
import { ensureUser } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const NOW = Date.parse("2026-10-07T10:00:00.000Z");
const INPUT = { code: "auth-code", verifier: "v".repeat(43), nonce: "n".repeat(43), redirectUri: "https://vnx.si/auth/oauth/github/callback", now: NOW };
const ACCESS = "gho_SECRET-ACCESS-TOKEN";
const PROFILE = { id: 583231, login: "octocat", name: "The Octocat", email: "octocat@github.example", avatar_url: "https://avatars.example/u/583231" };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const tokenOk = () => json({ access_token: ACCESS, token_type: "bearer", scope: "", refresh_token: "ghr_SECRET-REFRESH" });
const redirect = (status = 302) => new Response(null, { status, headers: { location: "https://evil.example/x" } });

type Call = { url: string; init: RequestInit };
/** Answers the n-th fetch with the n-th responder; a call beyond the list fails the test. */
function stubFetch(...responders: Array<() => Response | Promise<Response>>) {
  const calls: Call[] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    const respond = responders[calls.length - 1];
    if (!respond) throw new Error(`unexpected fetch #${calls.length}`);
    return respond();
  }) as typeof fetch;
  return { fn, calls };
}
const client = (fn: typeof fetch) => new GithubClient("client-id", "client-secret", fn);
const headersOf = (call: Call | undefined) => (call?.init.headers ?? {}) as Record<string, string>;
const run = (profile: unknown) => {
  const { fn, calls } = stubFetch(tokenOk, () => json(profile));
  return client(fn).exchange(INPUT).then((result) => ({ result, calls }));
};

describe("GithubClient requests (decision 3 (b), F1)", () => {
  it("exchanges the code at the constant token URL, then reads the profile once at the constant user URL", async () => {
    expect([GITHUB_TOKEN_URL, GITHUB_USER_URL]).toEqual(["https://github.com/login/oauth/access_token", "https://api.github.com/user"]);
    const { calls } = await run(PROFILE);
    expect(calls).toHaveLength(2);
    const [token, user] = calls;

    expect(token?.url).toBe(GITHUB_TOKEN_URL);
    expect(token?.init.method).toBe("POST");
    expect(token?.init.redirect).toBe("manual");
    expect(token?.init.signal).toBeInstanceOf(AbortSignal);
    expect(headersOf(token)).toMatchObject({ accept: "application/json", "content-type": "application/x-www-form-urlencoded" });
    expect(Object.fromEntries(new URLSearchParams(String(token?.init.body)))).toEqual({
      client_id: "client-id",
      client_secret: "client-secret",
      code: "auth-code",
      redirect_uri: INPUT.redirectUri,
      code_verifier: INPUT.verifier,
    });

    expect(user?.url).toBe(GITHUB_USER_URL);
    expect(user?.init.method).toBe("GET");
    expect(user?.init.redirect).toBe("manual");
    expect(user?.init.signal).toBeInstanceOf(AbortSignal);
    expect(user?.init.body).toBeUndefined();
    expect(headersOf(user)).toEqual({ authorization: `Bearer ${ACCESS}`, accept: "application/vnd.github+json", "user-agent": "vnx.si", "x-github-api-version": "2022-11-28" });
  });

  it("sends the access token only in the Authorization header of the profile call, nowhere in the token call", async () => {
    const { calls } = await run(PROFILE);
    const [token, user] = calls;
    expect(JSON.stringify({ url: token?.url, init: { ...token?.init, body: String(token?.init.body), signal: undefined } })).not.toContain(ACCESS);
    expect(user?.url).not.toContain(ACCESS);
    expect(JSON.stringify(headersOf(user)).split(ACCESS)).toHaveLength(2);
  });

  it("builds options the workerd runtime accepts for both calls: a Request made from each captured call does not throw", async () => {
    const { calls } = await run(PROFILE);
    expect(calls).toHaveLength(2);
    for (const call of calls) expect(() => new Request(call.url, call.init), call.url).not.toThrow();
  });

  it("treats any redirect on either call as a failure and goes no further", async () => {
    for (const status of [301, 302, 307]) {
      const first = stubFetch(() => redirect(status));
      expect(await client(first.fn).exchange(INPUT), `token ${status}`).toEqual({ ok: false, reason: "token_request" });
      expect(first.calls, `token ${status}`).toHaveLength(1);
      const second = stubFetch(tokenOk, () => redirect(status));
      expect(await client(second.fn).exchange(INPUT), `user ${status}`).toEqual({ ok: false, reason: "profile_request" });
      expect(second.calls, `user ${status}`).toHaveLength(2);
    }
  });

  it("passes the injected fetch through getOAuthProvider", async () => {
    const env = { ...testEnv, OAUTH_DRIVER: undefined, GITHUB_CLIENT_ID: "hid", GITHUB_CLIENT_SECRET: "hsecret" } as Bindings;
    const { fn, calls } = stubFetch(() => json({}, 500));
    const provider = getOAuthProvider(env, "github", fn);
    expect(provider).toBeInstanceOf(GithubClient);
    expect(await provider?.exchange(INPUT)).toEqual({ ok: false, reason: "token_request" });
    expect(calls.map((c) => c.url)).toEqual([GITHUB_TOKEN_URL]);
  });
});

describe("GithubClient result (ADR-012 §1, decision 12, F2, Review Focus 9)", () => {
  it("returns the numeric id as the subject and the login as the label, and nothing else", async () => {
    const { result } = await run(PROFILE);
    expect(result).toEqual({ ok: true, identity: { subject: "583231", label: "octocat" } });
    const text = JSON.stringify(result);
    for (const secret of [ACCESS, "ghr_SECRET-REFRESH", "client-secret", "auth-code", "The Octocat", "octocat@github.example", "avatars.example"]) expect(text, secret).not.toContain(secret);
  });

  it("keys the account on the id: a renamed login keeps the subject and changes only the label", async () => {
    const before = await run(PROFILE);
    const after = await run({ ...PROFILE, login: "renamed-cat" });
    expect(before.result).toEqual({ ok: true, identity: { subject: "583231", label: "octocat" } });
    expect(after.result).toEqual({ ok: true, identity: { subject: "583231", label: "renamed-cat" } });
  });

  it("accepts the largest safe id, and a 39-character login", async () => {
    const login = `a${"b".repeat(38)}`;
    expect((await run({ id: Number.MAX_SAFE_INTEGER, login })).result).toEqual({ ok: true, identity: { subject: "9007199254740991", label: login } });
  });

  it("refuses a missing, non-numeric or unsafe id (profile_response), and never falls back to the login", async () => {
    for (const id of [undefined, null, "583231", "octocat", 0, -5, 1.5, 9007199254740993, Number.NaN, true, [583231]]) {
      const { result } = await run({ ...PROFILE, id });
      expect(result, String(id)).toEqual({ ok: false, reason: "profile_response" });
    }
  });

  it("refuses a login that is missing, empty, too long or not a plain GitHub login (profile_response)", async () => {
    for (const login of [undefined, null, 42, "", " ", "a".repeat(40), "octo cat", "octo/cat", "octo?x=1", "octo#", "-octocat", "octo\ncat", "@octocat", "octocat[bot]", "é"]) {
      const { result } = await run({ ...PROFILE, login });
      expect(result, JSON.stringify(login)).toEqual({ ok: false, reason: "profile_response" });
    }
  });

  it("always gives a label the database accepts (1-254 characters)", async () => {
    const user = await ensureUser("github-label@vnx.si");
    const { result } = await run({ id: 7001, login: "x".repeat(39) });
    if (!result.ok) throw new Error(result.reason);
    expect(result.identity.label.length).toBeGreaterThanOrEqual(1);
    expect(result.identity.label.length).toBeLessThanOrEqual(254);
    expect((await linkIdentity(testEnv.DB, { userId: user.id, provider: "github", subject: result.identity.subject, label: result.identity.label, now: "2026-10-07T10:00:00.000Z" })).ok).toBe(true);
  });
});

describe("GithubClient failures give fixed codes", () => {
  it("maps a failed or non-2xx token request to token_request, without calling /user", async () => {
    const cases: Array<() => Response | Promise<Response>> = [() => json({ error: "server" }, 500), () => json({}, 401), () => { throw new TypeError("network failure"); }];
    for (const respond of cases) {
      const { fn, calls } = stubFetch(respond);
      expect(await client(fn).exchange(INPUT)).toEqual({ ok: false, reason: "token_request" });
      expect(calls).toHaveLength(1);
    }
  });

  it("maps an unreadable token response, or a 200 that carries an error or no access token, to token_response, without calling /user", async () => {
    const cases: Array<() => Response> = [
      () => new Response("access_token=abc&token_type=bearer", { status: 200 }),
      () => json([1, 2]),
      () => json({ error: "bad_verification_code", error_description: "The code passed is incorrect or expired." }),
      () => json({ access_token: "" }),
      () => json({ access_token: 5 }),
      () => json({ token_type: "bearer" }),
    ];
    for (const respond of cases) {
      const { fn, calls } = stubFetch(respond);
      expect(await client(fn).exchange(INPUT)).toEqual({ ok: false, reason: "token_response" });
      expect(calls).toHaveLength(1);
    }
  });

  it("maps a failed or non-2xx profile request to profile_request", async () => {
    const cases: Array<() => Response | Promise<Response>> = [() => json({ message: "Bad credentials" }, 401), () => json({}, 500), () => { throw new TypeError("network failure"); }];
    for (const respond of cases) {
      const { fn, calls } = stubFetch(tokenOk, respond);
      expect(await client(fn).exchange(INPUT)).toEqual({ ok: false, reason: "profile_request" });
      expect(calls).toHaveLength(2);
    }
  });

  it("maps an unreadable or non-object profile to profile_response", async () => {
    for (const respond of [() => new Response("<html>", { status: 200 }), () => json([PROFILE]), () => json("octocat"), () => json(null)]) {
      const { fn } = stubFetch(tokenOk, respond);
      expect(await client(fn).exchange(INPUT)).toEqual({ ok: false, reason: "profile_response" });
    }
  });

  it("logs nothing on success or failure, and no failure text carries a token (Review Focus 9)", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => undefined));
    try {
      const runs: Array<Array<() => Response>> = [[tokenOk, () => json(PROFILE)], [() => json({}, 500)], [() => json({ error: "bad_verification_code" })], [tokenOk, () => json({}, 401)], [tokenOk, () => json({ id: "x", login: "y" })]];
      for (const responders of runs) {
        const { fn } = stubFetch(...responders);
        const result = await client(fn).exchange(INPUT);
        expect(JSON.stringify(result)).not.toContain(ACCESS);
      }
      for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });
});
