import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.ts";
import { sha256Hex } from "../../src/auth/crypto.ts";
import { linkSessionHash, OAUTH_COOKIE } from "../../src/auth/oauth-cookie.ts";
import { FakeOAuthProvider, issueFakeCode, resetFakeOAuth } from "../../src/auth/oauth/fake.ts";
import { resetFlagCache } from "../../src/db/flags.ts";
import { linkIdentity } from "../../src/db/identities.ts";
import { isLinkCapableSession, isStaffSession, SESSION_METHODS, type OAuthProvider, type SessionMethod } from "../../src/domain/identity.ts";
import { encodeOAuthCookie, newLinkIntent, oauthRedirectUri, parseOAuthCookie } from "../../src/domain/oauth.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import { signIn } from "../fixtures.ts";
import { formPost, getReq, setCookieValue, testEnv } from "../helpers.ts";
import { callbackReq, enableProvider, linkedUser, linkViaStart } from "../oauth-flow.ts";

let counter = 0;
const tag = () => `${++counter}-${Math.random().toString(36).slice(2, 8)}`;
const emailOf = (who: string) => `${who}-${tag()}@example.com`; // D1 is shared: per-test addresses, no global counts
const n = async (sql: string, ...binds: unknown[]) => (await testEnv.DB.prepare(sql).bind(...binds).first<{ n: number }>())?.n ?? 0;
const identities = (userId: string) => n("SELECT count(*) AS n FROM user_identities WHERE user_id = ?1", userId);
const linkAudits = (userId: string) => n("SELECT count(*) AS n FROM audit_log WHERE actor_user_id = ?1 AND action = 'auth.identity.link'", userId);
const rawOf = (cookie: string) => cookie.split("=")[1] ?? "";
const codeFor = (provider: OAuthProvider, flow: { verifier: string; nonce: string }, identity: { subject: string; label: string }) =>
  issueFakeCode(provider, identity, { verifier: flow.verifier, nonce: flow.nonce, redirectUri: oauthRedirectUri(testEnv.APP_ORIGIN, provider) });
const postLink = (provider: string, cookie: string) => createApp().request(formPost(`/me/identities/${provider}/link`, {}, { cookie }), undefined, testEnv);

beforeEach(async () => {
  resetFakeOAuth();
  clearOutbox();
  await testEnv.DB.prepare("DELETE FROM feature_flags WHERE key LIKE 'oauth_%'").run();
  resetFlagCache();
  for (const m of ["error", "warn", "log", "info", "debug"] as const) vi.spyOn(console, m).mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("isLinkCapableSession (ADR-013)", () => {
  it("only magic_link; its own predicate, not the staff one", () => {
    for (const m of SESSION_METHODS) expect(isLinkCapableSession(m), m).toBe(m === "magic_link");
    // Delete this line the day the two rules diverge (it only records that they are equal today; they are separate predicates on purpose).
    for (const m of SESSION_METHODS) expect(isLinkCapableSession(m)).toBe(isStaffSession(m));
  });
});

describe("POST /me/identities/:provider/link needs a magic-link session (VNX-2605d)", () => {
  it("from an oauth_* session: 303 to /me?link=needsEmailLink, no intent cookie, no redirect to start", async () => {
    await enableProvider("github");
    await enableProvider("google");
    const email = emailOf("lan");
    await linkedUser(email, "github", { subject: `s-${tag()}`, label: `l-${tag()}` });
    for (const method of ["oauth_github", "oauth_google", "oauth_linkedin"] as const) {
      const { cookie } = await signIn(email, { method });
      const res = await postLink("google", cookie);
      expect(res.status, method).toBe(303);
      expect(res.headers.get("location"), method).toBe("/me?link=needsEmailLink");
      expect(setCookieValue(res, OAUTH_COOKIE), method).toBeNull(); // no intent cookie
      expect(res.headers.get("location")).not.toContain("/auth/oauth/");
    }
  });

  it("the redirect keeps the request locale: /vi/me/identities/google/link from an oauth_* session goes to /vi/me?link=needsEmailLink", async () => {
    await enableProvider("google");
    const { cookie } = await signIn(emailOf("lan"), { method: "oauth_github" });
    const res = await createApp().request(formPost("/vi/me/identities/google/link", {}, { cookie }), undefined, testEnv);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/vi/me?link=needsEmailLink");
  });

  it("from a magic_link session: unchanged, 303 to the same-site start with the intent cookie", async () => {
    await enableProvider("google");
    const { cookie } = await signIn(emailOf("lan"), { method: "magic_link" });
    const res = await postLink("google", cookie);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/auth/oauth/google/start?lang=en");
    expect(setCookieValue(res, OAUTH_COOKIE)).not.toBeNull();
  });

  it("an unknown provider is still 404 and a flag-off provider 404, whatever the session", async () => {
    const { cookie } = await signIn(emailOf("lan"), { method: "oauth_github" });
    expect((await postLink("facebook", cookie)).status).toBe(404);
    expect((await postLink("google", cookie)).status).toBe(404); // flag off
  });
});

describe("start with a link intent needs a magic-link session (VNX-2605d)", () => {
  it("an intent cookie bound to an oauth_* session gives a plain sign-in: 302, a signin flow, no link page", async () => {
    await enableProvider("google");
    const { cookie } = await signIn(emailOf("lan"), { method: "oauth_github" });
    const intent = encodeOAuthCookie(newLinkIntent({ provider: "google", sessionHash: await linkSessionHash(rawOf(cookie)) }, Date.now()));
    const res = await createApp().request(getReq("/auth/oauth/google/start", `${cookie}; ${OAUTH_COOKIE}=${intent}`), undefined, testEnv);
    expect(res.status).toBe(302);
    expect(new URL(res.headers.get("location") ?? "").hostname).toBe("accounts.google.com");
    const flow = parseOAuthCookie(setCookieValue(res, OAUTH_COOKIE) ?? "", { provider: "google", now: Date.now() });
    expect(flow?.phase === "flow" && flow.intent).toBe("signin");
  });

  it("the same bound to a magic_link session still gives the 200 link page (positive control)", async () => {
    await enableProvider("google");
    const { cookie } = await signIn(emailOf("lan"), { method: "magic_link" });
    const link = await linkViaStart("google", cookie);
    expect(link.start.status).toBe(200);
    expect(link.flow?.intent).toBe("link");
  });

  it("a live link flow of a session that has since become oauth_* is not shown again as a link page", async () => {
    await enableProvider("google");
    const { cookie } = await signIn(emailOf("lan"), { method: "magic_link" });
    const link = await linkViaStart("google", cookie);
    expect(link.start.status).toBe(200); // positive preconditions: the link flow really is live
    expect(link.flow?.intent).toBe("link");
    await testEnv.DB.prepare("UPDATE sessions SET method = 'oauth_github' WHERE id_hash = ?1").bind(await sha256Hex(rawOf(cookie))).run();
    const again = await createApp().request(getReq("/auth/oauth/google/start", `${cookie}; ${link.flowCookie}`), undefined, testEnv);
    expect(again.status).toBe(302);
    expect(new URL(again.headers.get("location") ?? "").hostname).toBe("accounts.google.com");
    const next = parseOAuthCookie(setCookieValue(again, OAUTH_COOKIE) ?? "", { provider: "google", now: Date.now() });
    expect(next?.phase === "flow" && next.intent).toBe("signin");
  });
});

describe("the callback's link branch (VNX-2605d)", () => {
  async function started(email: string, provider: OAuthProvider = "github") {
    await enableProvider(provider);
    const { user, cookie } = await signIn(email, { method: "magic_link" });
    const link = await linkViaStart(provider, cookie);
    if (!link.flow) throw new Error("no link flow"); // positive precondition: the flow really started on the magic_link session
    const identity = { subject: `s-${tag()}`, label: `l-${tag()}` };
    return { user, cookie, link, identity, flow: link.flow, code: codeFor(provider, link.flow, identity) };
  }
  const callback = (provider: OAuthProvider, s: Awaited<ReturnType<typeof started>>, session: string) =>
    callbackReq(provider, { code: s.code, state: s.flow.state }, `${session}; ${s.link.flowCookie}`);
  const nothingHappened = async (userId: string, email: string) => {
    expect(await identities(userId)).toBe(0);
    expect(await linkAudits(userId)).toBe(0);
    expect(outbox.filter((m) => m.to === email)).toHaveLength(0);
  };

  it("positive control: the same flow on the unchanged magic_link session links, audits and e-mails once", async () => {
    const email = emailOf("lan");
    const s = await started(email);
    const res = await callback("github", s, s.cookie);
    expect(res.headers.get("location")).toBe("/me?link=ok");
    expect(await identities(s.user.id)).toBe(1);
    expect(await linkAudits(s.user.id)).toBe(1);
    expect(outbox.filter((m) => m.to === email)).toHaveLength(1);
  });

  it("the session became oauth_* after the flow started: no link, no audit, no e-mail; the code is not spent (error page)", async () => {
    const email = emailOf("lan");
    const s = await started(email);
    await testEnv.DB.prepare("UPDATE sessions SET method = 'oauth_google' WHERE id_hash = ?1").bind(await sha256Hex(rawOf(s.cookie))).run();
    const exchange = vi.spyOn(FakeOAuthProvider.prototype, "exchange"); // pass-through: counts calls
    const res = await callback("github", s, s.cookie);
    expect(res.status).toBe(400);
    expect(exchange).not.toHaveBeenCalled(); // the check BEFORE the exchange: the code is not spent (fails without it)
    await nothingHappened(s.user.id, email);
  });

  it("the session was deleted after the flow started: no link (and no session to come back to)", async () => {
    const email = emailOf("lan");
    const s = await started(email);
    await testEnv.DB.prepare("DELETE FROM sessions WHERE id_hash = ?1").bind(await sha256Hex(rawOf(s.cookie))).run();
    const exchange = vi.spyOn(FakeOAuthProvider.prototype, "exchange");
    const res = await callback("github", s, s.cookie);
    expect(res.status).toBe(400);
    expect(exchange).not.toHaveBeenCalled();
    await nothingHappened(s.user.id, email);
  });

  it("another session of the same user (oauth_*) presenting the flow cookie: no link", async () => {
    const email = emailOf("lan");
    const s = await started(email);
    const other = await signIn(email, { method: "oauth_github" });
    const exchange = vi.spyOn(FakeOAuthProvider.prototype, "exchange");
    const res = await callback("github", s, other.cookie);
    expect(res.status).toBe(400);
    expect(exchange).not.toHaveBeenCalled();
    await nothingHappened(s.user.id, email);
  });

  it("RACE: the session is ended while the code is exchanged: no link, no audit, no e-mail, the error page", async () => {
    const email = emailOf("lan");
    const s = await started(email);
    const hash = await sha256Hex(rawOf(s.cookie));
    const real = FakeOAuthProvider.prototype.exchange;
    const exchange = vi.spyOn(FakeOAuthProvider.prototype, "exchange").mockImplementation(async function (this: FakeOAuthProvider, input) {
      const result = await real.call(this, input); // the exchange succeeds…
      await testEnv.DB.prepare("DELETE FROM sessions WHERE id_hash = ?1").bind(hash).run(); // …and the session ends right after it (restored by afterEach)
      return result;
    });
    const res = await callback("github", s, s.cookie);
    expect(res.status).toBe(400);
    expect(res.headers.get("location")).toBeNull();
    expect(exchange).toHaveBeenCalledTimes(1); // the exchange DID run (the pre-exchange check passed), so only the in-SQL guard stopped the link
    expect(await n("SELECT count(*) AS n FROM sessions WHERE id_hash = ?1", hash)).toBe(0); // positive precondition: the session row really is gone
    await nothingHappened(s.user.id, email);
  });

  it("RACE at the SQL level: linkIdentity with a session that no longer exists writes nothing, not even an audit row", async () => {
    const { user, cookie } = await signIn(emailOf("lan"), { method: "magic_link" });
    const idHash = await sha256Hex(rawOf(cookie));
    const now = new Date().toISOString();
    const args = { userId: user.id, provider: "github" as const, subject: `s-${tag()}`, label: `l-${tag()}`, now };
    await testEnv.DB.prepare("DELETE FROM sessions WHERE id_hash = ?1").bind(idHash).run();
    expect(await linkIdentity(testEnv.DB, { ...args, requireSession: { idHash } })).toEqual({ ok: false, reason: "session_ended" });
    expect(await identities(user.id)).toBe(0);
    expect(await linkAudits(user.id)).toBe(0);
    // an oauth_* row with that hash is refused the same way, a live magic_link one passes
    const alive = await signIn(emailOf("lan"), { method: "oauth_github" });
    const oauthHash = await sha256Hex(rawOf(alive.cookie));
    expect(await linkIdentity(testEnv.DB, { ...args, userId: alive.user.id, requireSession: { idHash: oauthHash } })).toEqual({ ok: false, reason: "session_ended" });
    const good = await signIn(emailOf("lan"), { method: "magic_link" });
    expect((await linkIdentity(testEnv.DB, { ...args, userId: good.user.id, requireSession: { idHash: await sha256Hex(rawOf(good.cookie)) } })).ok).toBe(true);
    // another user's session id does not count for this user
    const victim = await signIn(emailOf("victim"), { method: "magic_link" });
    const stranger = await signIn(emailOf("stranger"), { method: "magic_link" });
    expect(await linkIdentity(testEnv.DB, { ...args, subject: `s-${tag()}`, userId: victim.user.id, requireSession: { idHash: await sha256Hex(rawOf(stranger.cookie)) } })).toEqual({ ok: false, reason: "session_ended" });
  });
});

describe("unlinking stays allowed from any session (VNX-2605d, ADR-013)", () => {
  it("an oauth_* session can unlink", async () => {
    const email = emailOf("lan");
    const { user } = await linkedUser(email, "github", { subject: `s-${tag()}`, label: `l-${tag()}` });
    const { cookie } = await signIn(email, { method: "oauth_linkedin" });
    const res = await createApp().request(formPost("/me/identities/github/unlink", {}, { cookie }), undefined, testEnv);
    expect(res.headers.get("location")).toBe("/me?link=unlinked");
    expect(await identities(user.id)).toBe(0);
  });
});

describe("/me for a session that cannot link (VNX-2605d)", () => {
  const section = async (path: string, cookie: string) => {
    const html = await (await createApp().request(getReq(path, cookie), undefined, testEnv)).text();
    return html.match(/<section id="identities">.*?<\/section>/s)?.[0] ?? "";
  };
  const NOTE: Array<[string, string]> = [
    ["/me", "To link another account, sign out, then sign in with an email link."],
    ["/vi/me", "Muốn liên kết thêm tài khoản, hãy đăng xuất rồi đăng nhập bằng link qua email."],
    ["/zh-hans/me", "要关联其他账号，请先退出登录，再用邮箱登录。"],
    ["/zh-hant/me", "要連結其他帳號，請先登出，再用電子郵件登入。"],
  ];

  it("an oauth_* session sees the note, no Link form, and still the Unlink form; a magic_link session sees the Link form and no note", async () => {
    await enableProvider("google");
    await enableProvider("github");
    const email = emailOf("lan");
    await linkedUser(email, "github", { subject: `s-${tag()}`, label: `l-${tag()}` });
    const oauth = await signIn(email, { method: "oauth_github" });
    const magic = await signIn(email, { method: "magic_link" });
    for (const [path, text] of NOTE) {
      const html = (await section(path, oauth.cookie)).replace(/&#39;/g, "'");
      expect(html, path).toContain(text);
      expect(html, path).not.toContain("/google/link");
      expect(html, path).toContain("/github/unlink");
    }
    const withLink = await section("/me", magic.cookie);
    expect(withLink).toContain("/me/identities/google/link");
    expect(withLink).not.toContain("To link another account, sign out");
  });

  it("?link=needsEmailLink shows its message once and not the note as well", async () => {
    await enableProvider("google");
    const { cookie } = await signIn(emailOf("lan"), { method: "oauth_google" });
    const html = await section("/me?link=needsEmailLink", cookie);
    expect(html).toContain("To link a new account, you need to be signed in with an email link.");
    expect(html).not.toContain("To link another account, sign out");
    expect(html).toContain('role="status"');
  });
});
