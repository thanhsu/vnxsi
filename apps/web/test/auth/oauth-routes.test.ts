import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.ts";
import { linkSessionHash, OAUTH_COOKIE } from "../../src/auth/oauth-cookie.ts";
import { issueFakeCode, resetFakeOAuth } from "../../src/auth/oauth/fake.ts";
import { resetFlagCache } from "../../src/db/flags.ts";
import { createOpsInviteStatement, findPendingOpsInvite } from "../../src/db/ops-members.ts";
import { setUserStatusStatement } from "../../src/db/users.ts";
import { OAUTH_PROVIDERS, type OAuthProvider } from "../../src/domain/identity.ts";
import { codeChallengeS256, encodeOAuthCookie, newFlowCookie, newLinkIntent, oauthRedirectUri } from "../../src/domain/oauth.ts";
import type { Bindings } from "../../src/env.ts";
import { ensureUser, signIn } from "../fixtures.ts";
import { getReq, setCookieValue, testEnv } from "../helpers.ts";
import { callbackReq, clearedOAuthCookie, enableProvider, issueCodeFor, linkedUser, startOAuth, type StartedFlow } from "../oauth-flow.ts";

let counter = 0;
const tag = () => `${++counter}-${Math.random().toString(36).slice(2, 8)}`;
const identityOf = () => ({ subject: `sub-${tag()}`, label: `login-${tag()}` });
const emailOf = (who: string) => `${who}-${tag()}@example.com`;
const countWhere = async (sql: string, ...binds: unknown[]) => (await testEnv.DB.prepare(sql).bind(...binds).first<{ n: number }>())?.n ?? 0;
const sessionsOf = (userId: string) => countWhere("SELECT count(*) AS n FROM sessions WHERE user_id = ?1", userId);
const allSessions = () => countWhere("SELECT count(*) AS n FROM sessions");
const identitiesWithSubject = (...subjects: string[]) => countWhere(`SELECT count(*) AS n FROM user_identities WHERE provider_subject IN (${subjects.map((_, i) => `?${i + 1}`).join(",")})`, ...subjects);
const normalize = (html: string) => html.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "<id>");
const withoutCredentials = { ...testEnv, OAUTH_DRIVER: undefined } as Bindings;

// Every console method is spied for the whole file: any log line a request produces is checked (Review Focus 9).
const spies: Array<ReturnType<typeof vi.spyOn>> = [];
beforeEach(async () => {
  resetFakeOAuth();
  await testEnv.DB.prepare("DELETE FROM feature_flags WHERE key LIKE 'oauth_%'").run();
  resetFlagCache();
  for (const method of ["error", "warn", "log", "info", "debug"] as const) spies.push(vi.spyOn(console, method).mockImplementation(() => {}));
});
afterEach(() => {
  for (const spy of spies.splice(0)) spy.mockRestore();
});
const logged = () => spies.flatMap((spy) => spy.mock.calls).map((args) => args.map(String).join(" "));
const forgetLogs = () => spies.forEach((spy) => spy.mockClear());

/** Exactly one log line, with exactly these keys, the expected code, and none of the secrets (F5, Review Focus 9). */
function expectOneLog(code: string, secrets: string[], event = "oauth.callback_failed", provider = "github") {
  const lines = logged();
  expect(lines, `log lines: ${lines.join(" | ")}`).toHaveLength(1);
  const entry = JSON.parse(lines[0] ?? "{}") as Record<string, unknown>;
  expect(Object.keys(entry).sort()).toEqual(["code", "event", "provider", "requestId"]);
  expect(entry).toMatchObject({ event, provider, code });
  for (const secret of [...secrets, "fake-code-"]) expect(lines[0]).not.toContain(secret);
}

/** L3: every non-redirect response of the routes carries both headers, 404, 403 and 429 included. */
function expectHardened(res: Response) {
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(res.headers.get("referrer-policy")).toBe("same-origin");
}

async function linkIntentCookie(sessionCookie: string, provider: OAuthProvider) {
  const raw = sessionCookie.split("=")[1] ?? "";
  return `${OAUTH_COOKIE}=${encodeOAuthCookie(newLinkIntent({ provider, sessionHash: await linkSessionHash(raw) }, Date.now()))}`;
}

describe("start (ADR-012 §1, §3)", () => {
  it.each(OAUTH_PROVIDERS)("%s: 302 to the provider with state, PKCE S256 and the fixed redirect URI", async (provider) => {
    await enableProvider(provider);
    const started = await startOAuth(provider, "?next=/vi/me&lang=vi");
    const url = started.authorize;
    expect(started.res.headers.get("cache-control")).toBe("no-store");
    expect(started.res.headers.get("referrer-policy")).toBe("same-origin");
    expect(url.searchParams.get("state")).toBe(started.flow.state);
    // Task 4: all three providers, GitHub included, carry the S256 challenge of the cookie's verifier.
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe(await codeChallengeS256(started.flow.verifier));
    expect(url.searchParams.get("redirect_uri")).toBe(oauthRedirectUri(testEnv.APP_ORIGIN, provider));
    expect(url.searchParams.has("nonce")).toBe(provider !== "github");
    expect(started.flow).toMatchObject({ intent: "signin", sessionHash: null, next: "/vi/me", locale: "vi" });
    const line = started.res.headers.getSetCookie().find((l) => l.startsWith(`${OAUTH_COOKIE}=`)) ?? "";
    expect(line).toMatch(/HttpOnly/);
    expect(line).toMatch(/Secure/);
    expect(line).toMatch(/SameSite=Lax/);
  });

  it("takes the locale from next when lang is absent, and drops an unsafe next", async () => {
    await enableProvider("google");
    expect((await startOAuth("google", "?next=/zh-hant/hub")).flow.locale).toBe("zh-Hant");
    expect((await startOAuth("google", "?lang=zh-Hans")).flow.locale).toBe("zh-Hans");
    const unsafe = await startOAuth("google", `?next=${encodeURIComponent("//evil.example")}&lang=klingon`);
    expect(unsafe.flow).toMatchObject({ next: null, locale: "en" });
  });

  it("answers 404 for an unknown provider, an off flag and a missing credential, on start and callback", async () => {
    for (const provider of OAUTH_PROVIDERS) {
      const start = await createApp().request(getReq(`/auth/oauth/${provider}/start`), undefined, testEnv);
      expect(start.status, `${provider} off`).toBe(404);
      expectHardened(start);
      expect((await callbackReq(provider, { state: "x", code: "y" })).status, `${provider} off`).toBe(404);
    }
    expect((await createApp().request(getReq("/auth/oauth/facebook/start"), undefined, testEnv)).status).toBe(404);
    expect((await callbackReq("facebook", { state: "x", code: "y" })).status).toBe(404);
    await enableProvider("github");
    expect((await createApp().request(getReq("/auth/oauth/github/start"), undefined, withoutCredentials)).status, "flag on, no credentials").toBe(404);
    expect((await callbackReq("github", { state: "x", code: "y" }, undefined, {}, withoutCredentials)).status, "flag on, no credentials").toBe(404);
    expect((await createApp().request(getReq("/auth/oauth/google/start"), undefined, testEnv)).status, "another provider's flag stays off").toBe(404);
  });

  it("clears the OAuth cookie on a 404 callback too, and the 404 is hardened", async () => {
    const res = await callbackReq("google", { state: "x" });
    expect(res.status).toBe(404);
    expectHardened(res);
    expect(clearedOAuthCookie(res)).not.toBeNull();
  });

  // Task 2 LOW-2: the session hash is passed only for a live session.
  it("ignores a link-intent cookie whose session has expired: plain sign-in", async () => {
    await enableProvider("github");
    const { user, cookie } = await signIn(emailOf("lan"));
    const intent = await linkIntentCookie(cookie, "github");
    await testEnv.DB.prepare("UPDATE sessions SET expires_at = ?2 WHERE user_id = ?1").bind(user.id, "2020-01-01T00:00:00.000Z").run();
    const started = await startOAuth("github", "", `${cookie}; ${intent}`);
    expect(started.flow.intent).toBe("signin");
  });

  it("a live link intent gets the intermediate page", async () => {
    await enableProvider("github");
    const { cookie } = await signIn(emailOf("lan"));
    const intent = await linkIntentCookie(cookie, "github");
    forgetLogs();
    const res = await createApp().request(getReq("/auth/oauth/github/start", `${cookie}; ${intent}`), undefined, testEnv);
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    expectHardened(res);
    expect(setCookieValue(res, OAUTH_COOKIE)).not.toBeNull();
    expect(logged()).toHaveLength(0);
  });
});

describe("callback: sign in (ADR-012 §3)", () => {
  it.each(OAUTH_PROVIDERS)("%s: a linked user gets an oauth session, an audit row and a redirect to next", async (provider) => {
    await enableProvider(provider);
    const subject = `sub-${tag()}`;
    const { user, identity } = await linkedUser(emailOf(`lan-${provider}`), provider, { subject, label: "old-label" });
    const started = await startOAuth(provider, "?next=/me&lang=en");
    const code = issueCodeFor(provider, started, { subject, label: "new-label" });
    const res = await callbackReq(provider, { code, state: started.flow.state }, started.cookie);

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/me");
    expectHardened(res);
    expect(clearedOAuthCookie(res)).not.toBeNull();
    expect(setCookieValue(res, "__Host-vnx_session")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const session = await testEnv.DB.prepare("SELECT method FROM sessions WHERE user_id = ?1").bind(user.id).first<{ method: string }>();
    expect(session?.method).toBe(`oauth_${provider}`);
    // F10: the same bookkeeping as completeLogin.
    const login = await testEnv.DB.prepare("SELECT last_login_at FROM users WHERE id = ?1").bind(user.id).first<{ last_login_at: string | null }>();
    expect(login?.last_login_at).not.toBeNull();
    const audit = await testEnv.DB.prepare("SELECT actor_user_id, entity, data FROM audit_log WHERE action = 'auth.login' AND entity_id = ?1").bind(user.id).all<{ actor_user_id: string; entity: string; data: string }>();
    expect(audit.results).toHaveLength(1);
    expect(audit.results[0]).toMatchObject({ actor_user_id: user.id, entity: "user" });
    expect(JSON.parse(audit.results[0]?.data ?? "{}")).toEqual({ method: `oauth_${provider}` });
    const touched = await testEnv.DB.prepare("SELECT label, last_used_at FROM user_identities WHERE id = ?1").bind(identity.id).first<{ label: string; last_used_at: string | null }>();
    expect(touched?.label).toBe("new-label");
    expect(touched?.last_used_at).not.toBeNull();
    expect(logged()).toEqual([]); // a successful sign-in logs nothing
  });

  it("passes next through safeNext on redirect and falls back to the locale home", async () => {
    await enableProvider("github");
    const id = identityOf();
    await linkedUser(emailOf("lan"), "github", id);
    // The cookie layer lets this one through (it does not decode); safeNext does not.
    const crafted = newFlowCookie({ provider: "github", intent: "signin", state: "s".repeat(43), verifier: "v".repeat(43), nonce: "n".repeat(43), next: "/%2F%2Fevil.example", locale: "vi", sessionHash: null }, Date.now());
    const code = issueFakeCode("github", id, { verifier: crafted.verifier, nonce: crafted.nonce, redirectUri: oauthRedirectUri(testEnv.APP_ORIGIN, "github") });
    const res = await callbackReq("github", { code, state: crafted.state }, `${OAUTH_COOKIE}=${encodeOAuthCookie(crafted)}`);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/vi/");
  });

  it("a replayed callback fails and creates no second session", async () => {
    await enableProvider("github");
    const id = identityOf();
    const { user } = await linkedUser(emailOf("lan"), "github", id);
    const started = await startOAuth("github");
    const code = issueCodeFor("github", started, id);
    expect((await callbackReq("github", { code, state: started.flow.state }, started.cookie)).status).toBe(303);
    expect(await sessionsOf(user.id)).toBe(1);
    // The browser dropped the cookie (the response deleted it): no cookie, no state, 400.
    expect((await callbackReq("github", { code, state: started.flow.state })).status).toBe(400);
    // A replay WITH the old cookie is stopped only by the provider's single-use code (the fake burns it, S2), not by us.
    expect((await callbackReq("github", { code, state: started.flow.state }, started.cookie)).status).toBe(400);
    expect(await sessionsOf(user.id)).toBe(1);
  });

  it("a suspended user is refused like a magic link: 403, no session, hardened", async () => {
    await enableProvider("github");
    const id = identityOf();
    const { user } = await linkedUser(emailOf("lan"), "github", id);
    await setUserStatusStatement(testEnv.DB, { id: user.id, from: "active", to: "suspended", now: new Date().toISOString() }).run();
    const started = await startOAuth("github");
    const res = await callbackReq("github", { code: issueCodeFor("github", started, id), state: started.flow.state }, started.cookie);
    expect(res.status).toBe(403);
    expectHardened(res);
    expect(setCookieValue(res, "__Host-vnx_session")).toBeNull();
    expect(await sessionsOf(user.id)).toBe(0);
    expect(clearedOAuthCookie(res)).not.toBeNull();
  });

  // F3
  it("a user with a pending Ops invite who signs in by OAuth gets no ops_members row; the invite stays pending", async () => {
    await enableProvider("github");
    const id = identityOf();
    const { user } = await linkedUser(emailOf("ops-candidate"), "github", id);
    const owner = await ensureUser(emailOf("owner"));
    await createOpsInviteStatement(testEnv.DB, { email: user.email, role: "operator", createdBy: owner.id, now: new Date().toISOString() }).statement.run();
    const started = await startOAuth("github");
    const res = await callbackReq("github", { code: issueCodeFor("github", started, id), state: started.flow.state }, started.cookie);
    expect(res.status).toBe(303);
    expect(await countWhere("SELECT count(*) AS n FROM ops_members WHERE user_id = ?1", user.id)).toBe(0);
    expect((await findPendingOpsInvite(testEnv.DB, user.email))?.status).toBe("pending");
  });

  it("refuses a flow cookie whose intent is link until Task 8, without calling the provider, logging link_unsupported", async () => {
    await enableProvider("github");
    const id = identityOf();
    const { cookie: session } = await signIn(emailOf("lan"));
    const raw = session.split("=")[1] ?? "";
    const link = newFlowCookie({ provider: "github", intent: "link", state: "s".repeat(43), verifier: "v".repeat(43), nonce: "n".repeat(43), next: null, locale: "en", sessionHash: await linkSessionHash(raw) }, Date.now());
    const code = issueFakeCode("github", id, { verifier: link.verifier, nonce: link.nonce, redirectUri: oauthRedirectUri(testEnv.APP_ORIGIN, "github") });
    forgetLogs();
    const res = await callbackReq("github", { code, state: link.state }, `${session}; ${OAUTH_COOKIE}=${encodeOAuthCookie(link)}`);
    expect(res.status).toBe(400);
    expect(clearedOAuthCookie(res)).not.toBeNull();
    expect(await identitiesWithSubject(id.subject)).toBe(0);
    expectOneLog("link_unsupported", [link.state, link.verifier, link.nonce, id.subject]);
  });
});

describe("callback: not linked (ADR-012 §3.2; Review Focus 2)", () => {
  async function notLinked(provider: OAuthProvider, identity: { subject: string; label: string }, lang = "en") {
    const started = await startOAuth(provider, `?lang=${lang}`);
    const res = await callbackReq(provider, { code: issueCodeFor(provider, started, identity), state: started.flow.state }, started.cookie);
    return { res, html: await res.text() };
  }

  it("creates no user, session or identity, and is byte-identical whether or not the provider e-mail matches an account", async () => {
    await enableProvider("google");
    const known = emailOf("known");
    await ensureUser(known);
    const strangerId = { subject: `g-${tag()}`, label: `stranger-${tag()}@example.org` };
    // The provider e-mail equals an existing account's address: still "not linked", still the same bytes (decision 12).
    const lookalikeId = { subject: `g-${tag()}`, label: known };
    const [users, sessions] = [await countWhere("SELECT count(*) AS n FROM users"), await allSessions()];
    const stranger = await notLinked("google", strangerId);
    const lookalike = await notLinked("google", lookalikeId);
    for (const r of [stranger, lookalike]) {
      expect(r.res.status).toBe(200);
      expectHardened(r.res);
      expect(r.res.headers.get("location")).toBeNull();
      expect(setCookieValue(r.res, "__Host-vnx_session")).toBeNull();
      expect(clearedOAuthCookie(r.res)).not.toBeNull();
      expect(r.html).toContain("Sign in with an email link");
    }
    expect(normalize(stranger.html)).toBe(normalize(lookalike.html));
    expect(lookalike.html).not.toContain(known);
    expect(stranger.html).not.toContain(strangerId.label);
    expect(await countWhere("SELECT count(*) AS n FROM users")).toBe(users);
    expect(await allSessions()).toBe(sessions);
    expect(await identitiesWithSubject(strangerId.subject, lookalikeId.subject)).toBe(0);
  });

  it("is in the visitor's language from the flow cookie, with the approved Vietnamese sentence", async () => {
    await enableProvider("google");
    const { html } = await notLinked("google", identityOf(), "vi");
    const text = html.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    expect(text).toContain("Tài khoản này chưa được liên kết. Đăng nhập bằng link qua email, rồi liên kết ở mục “Đăng nhập & tài khoản liên kết” trong trang Yêu cầu và nhu cầu.");
  });

  it("loads nothing inline (CSP)", async () => {
    await enableProvider("google");
    const { html } = await notLinked("google", identityOf());
    expect(html).not.toMatch(/\sstyle=|<script/i);
  });
});

describe("callback: every failure is the same generic page (Review Focus 1)", () => {
  type Id = { subject: string; label: string };
  type Case = [name: string, code: string, run: (s: StartedFlow, id: Id) => Promise<Response>];
  const cases: Case[] = [
    ["no cookie", "no_cookie", async (s, id) => callbackReq("github", { code: issueCodeFor("github", s, id), state: s.flow.state })],
    ["state missing", "state_mismatch", async (s, id) => callbackReq("github", { code: issueCodeFor("github", s, id) }, s.cookie)],
    ["state wrong", "state_mismatch", async (s, id) => callbackReq("github", { code: issueCodeFor("github", s, id), state: "x".repeat(43) }, s.cookie)],
    ["code missing", "missing_code", async (s) => callbackReq("github", { state: s.flow.state }, s.cookie)],
    ["code over-length", "missing_code", async (s) => callbackReq("github", { code: "a".repeat(2049), state: s.flow.state }, s.cookie)],
    ["user denied at the provider", "provider_denied", async (s) => callbackReq("github", { error: "access_denied", error_description: "secret-desc", state: s.flow.state }, s.cookie)],
    ["code never issued", "token_request", async (s) => callbackReq("github", { code: "unknown-code", state: s.flow.state }, s.cookie)],
    ["wrong verifier", "token_request", async (s, id) => callbackReq("github", { code: issueCodeFor("github", s, id, { verifier: "w".repeat(43) }), state: s.flow.state }, s.cookie)],
    ["wrong redirect URI", "token_request", async (s, id) => callbackReq("github", { code: issueCodeFor("github", s, id, { redirectUri: "https://evil.example/cb" }), state: s.flow.state }, s.cookie)],
    ["cookie of another provider (F5)", "no_cookie", async (s, id) => {
      await enableProvider("google");
      const other = await startOAuth("google");
      // The state and the cookie belong to Google; the URL says GitHub.
      return callbackReq("github", { code: issueCodeFor("github", s, id), state: other.flow.state }, other.cookie);
    }],
    ["expired cookie", "no_cookie", async (s, id) => {
      const expired = { ...s.flow, exp: Date.now() - 1000 };
      return callbackReq("github", { code: issueCodeFor("github", s, id), state: s.flow.state }, `${OAUTH_COOKIE}=${encodeOAuthCookie(expired)}`);
    }],
    ["link-intent cookie at the callback", "wrong_phase", async (_s, id) => {
      const { cookie: session } = await signIn(emailOf("lan"));
      return callbackReq("github", { code: "whatever", state: "x".repeat(43) }, `${OAUTH_COOKIE}=${(await linkIntentCookie(session, "github")).split("=")[1]}`);
    }],
  ];

  it.each(cases)("%s: 400, no session, no redirect, cookie cleared, one fixed log code, same page", async (_name, expectedCode, run) => {
    await enableProvider("github");
    const id = identityOf();
    const email = emailOf("lan");
    const { user } = await linkedUser(email, "github", id);
    const started = await startOAuth("github");
    forgetLogs();
    const res = await run(started, id);
    expect(res.status).toBe(400);
    expect(res.headers.get("location")).toBeNull();
    expectHardened(res);
    expect(setCookieValue(res, "__Host-vnx_session")).toBeNull();
    expect(clearedOAuthCookie(res)).not.toBeNull();
    const html = await res.text();
    expect(html).toContain("We couldn&#39;t sign you in");
    expect(html).not.toContain(started.flow.state);
    expect(await sessionsOf(user.id)).toBe(0);
    expectOneLog(expectedCode, [started.flow.state, started.flow.verifier, started.flow.nonce, id.subject, id.label, email, "secret-desc"]);
  });

  it("rejects a Google-written cookie at the GitHub callback even when its state matches (F5)", async () => {
    await enableProvider("github");
    await enableProvider("google");
    const google = await startOAuth("google");
    forgetLogs();
    const res = await callbackReq("github", { code: "whatever", state: google.flow.state }, google.cookie);
    expect(res.status).toBe(400);
    expectOneLog("no_cookie", [google.flow.state]);
  });
});

describe("callback: rate limit (Decision 10)", () => {
  it("allows 20 callbacks per hour per IP under oauth:ip:<ip>, then answers 429 with one fixed log code", async () => {
    await enableProvider("github");
    const ip = `203.0.113.${100 + (counter % 100)}`;
    const headers = { "cf-connecting-ip": ip };
    for (let i = 0; i < 20; i++) expect((await callbackReq("github", { state: "x" }, undefined, headers)).status, `call ${i + 1}`).toBe(400);
    forgetLogs();
    const blocked = await callbackReq("github", { state: "x" }, undefined, headers);
    expect(blocked.status).toBe(429);
    expectHardened(blocked);
    expect(clearedOAuthCookie(blocked)).not.toBeNull();
    expectOneLog("rate_limited", []);
    expect((await callbackReq("github", { state: "x" }, undefined, { "cf-connecting-ip": "203.0.114.1" })).status).toBe(400);
    const row = await testEnv.DB.prepare("SELECT count FROM rate_limits WHERE key = ?1").bind(`oauth:ip:${ip}`).first<{ count: number }>();
    expect(row?.count).toBe(21);
  });
});

describe("callback: an unexpected error (F5)", () => {
  it("becomes the code `internal`: the error text is never logged", async () => {
    await enableProvider("github");
    await startOAuth("github"); // warms the flag cache, so only the rate-limit query reaches the broken database
    forgetLogs();
    const broken = {
      ...testEnv,
      DB: new Proxy(testEnv.DB, {
        get: (target, prop) =>
          prop === "prepare"
            ? () => {
                throw new Error("secret-db-failure-42");
              }
            : Reflect.get(target, prop),
      }),
    } as Bindings;
    const res = await callbackReq("github", { state: "x" }, undefined, {}, broken);
    expect(res.status).toBe(400);
    expectOneLog("internal", ["secret-db-failure-42"]);
  });
});
