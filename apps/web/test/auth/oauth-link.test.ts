import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.ts";
import { linkSessionHash, OAUTH_COOKIE } from "../../src/auth/oauth-cookie.ts";
import { clearOutbox, FakeMailer, outbox } from "../../src/email/fake.ts";
import { formatUtc } from "../../src/email/templates/identity.ts";
import { issueFakeCode, resetFakeOAuth } from "../../src/auth/oauth/fake.ts";
import { resetFlagCache } from "../../src/db/flags.ts";
import type { OAuthProvider } from "../../src/domain/identity.ts";
import { encodeOAuthCookie, newFlowCookie, oauthRedirectUri } from "../../src/domain/oauth.ts";
import { ensureUser, signIn } from "../fixtures.ts";
import { getReq, testEnv } from "../helpers.ts";
import { callbackReq, clearedOAuthCookie, enableProvider, linkedUser, linkViaStart } from "../oauth-flow.ts";

let counter = 0;
const tag = () => `${++counter}-${Math.random().toString(36).slice(2, 8)}`;
const emailOf = (who: string) => `${who}-${tag()}@example.com`;
const identityOf = () => ({ subject: `sub-${tag()}`, label: `login-${tag()}` });
const count = async (sql: string, ...binds: unknown[]) => (await testEnv.DB.prepare(sql).bind(...binds).first<{ n: number }>())?.n ?? 0;
const sessionsOf = (userId: string) => count("SELECT count(*) AS n FROM sessions WHERE user_id = ?1", userId);
const linkAudits = (userId: string) => count("SELECT count(*) AS n FROM audit_log WHERE actor_user_id = ?1 AND action = 'auth.identity.link'", userId);
const identitiesOf = (userId: string) => count("SELECT count(*) AS n FROM user_identities WHERE user_id = ?1", userId);
const redirectUri = (provider: OAuthProvider) => oauthRedirectUri(testEnv.APP_ORIGIN, provider);

const spies: Array<ReturnType<typeof vi.spyOn>> = [];
beforeEach(async () => {
  resetFakeOAuth();
  clearOutbox();
  await testEnv.DB.prepare("DELETE FROM feature_flags WHERE key LIKE 'oauth_%'").run();
  resetFlagCache();
  for (const method of ["error", "warn", "log", "info", "debug"] as const) spies.push(vi.spyOn(console, method).mockImplementation(() => {}));
});
afterEach(() => spies.splice(0).forEach((spy) => spy.mockRestore()));
const logged = () => spies.flatMap((spy) => spy.mock.calls).map((args) => args.map(String).join(" "));
const loggedCodes = () => logged().map((line) => (JSON.parse(line) as { code: string }).code);

/** The user is signed in (magic link), presses Link, comes back from the provider with a code for `identity`. */
async function comeBack(provider: OAuthProvider, session: string, identity: { subject: string; label: string }, postPrefix = "") {
  const link = await linkViaStart(provider, session, { postPrefix });
  if (!link.flow) throw new Error("no link flow");
  const code = issueFakeCode(provider, identity, { verifier: link.flow.verifier, nonce: link.flow.nonce, redirectUri: redirectUri(provider) });
  return { link, code, res: await callbackReq(provider, { code, state: link.flow.state }, `${session}; ${link.flowCookie}`) };
}
/** Hono escapes & ' " < >; a browser shows the characters (pattern of test/landing/page.test.ts:15). */
const decode = (s: string) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const meHtml = async (path: string, cookie: string) => decode(await (await createApp().request(getReq(path, cookie), undefined, testEnv)).text());
/** The 303 back to /me is hardened and clears the OAuth cookie, whatever the outcome (LOW-2). */
function expectBack(res: Response, location: string) {
  expect(res.status).toBe(303);
  expect(res.headers.get("location")).toBe(location);
  expect(clearedOAuthCookie(res)).not.toBeNull();
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(res.headers.get("referrer-policy")).toBe("same-origin");
}

describe("callback with a link flow (ADR-012 §4)", () => {
  it("links the account to the signed-in user, audits, and redirects to /me with a success notice", async () => {
    await enableProvider("github");
    const { user, cookie } = await signIn(emailOf("lan"));
    const id = identityOf();
    const before = await sessionsOf(user.id);
    const { res } = await comeBack("github", cookie, id);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/me?link=ok");
    expect(await identitiesOf(user.id)).toBe(1);
    const row = await testEnv.DB.prepare("SELECT provider, provider_subject, label, show_on_profile FROM user_identities WHERE user_id = ?1").bind(user.id).first();
    expect(row).toEqual({ provider: "github", provider_subject: id.subject, label: id.label, show_on_profile: 0 });
    expect(await linkAudits(user.id)).toBe(1);
    const audit = await testEnv.DB.prepare("SELECT data FROM audit_log WHERE actor_user_id = ?1 AND action = 'auth.identity.link'").bind(user.id).first<{ data: string }>();
    expect(JSON.parse(audit?.data ?? "{}")).toEqual({ provider: "github" });
    expect(clearedOAuthCookie(res)).not.toBeNull();
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("referrer-policy")).toBe("same-origin");
    // No sign-in: no new session, no session cookie, the method is the one it was.
    expect(await sessionsOf(user.id)).toBe(before);
    expect(res.headers.getSetCookie().some((l) => l.startsWith("__Host-vnx_session="))).toBe(false);
    expect(await count("SELECT count(*) AS n FROM sessions WHERE user_id = ?1 AND method <> 'magic_link'", user.id)).toBe(0);
    expect(logged()).toHaveLength(0);
  });

  it.each([["", "/me?link=ok"], ["/vi", "/vi/me?link=ok"], ["/zh-hans", "/zh-hans/me?link=ok"], ["/zh-hant", "/zh-hant/me?link=ok"]])("redirects to the locale of the flow (POST prefix %j)", async (prefix, location) => {
    await enableProvider("google");
    const { cookie } = await signIn(emailOf("lan"));
    const { res } = await comeBack("google", cookie, identityOf(), prefix);
    expect(res.headers.get("location")).toBe(location);
  });

  it("works from an OAuth session too, and keeps its method", async () => {
    await enableProvider("google");
    const { user, cookie } = await signIn(emailOf("lan"), { method: "oauth_github" });
    const { res } = await comeBack("google", cookie, identityOf());
    expect(res.headers.get("location")).toBe("/me?link=ok");
    expect(await count("SELECT count(*) AS n FROM sessions WHERE user_id = ?1 AND method = 'oauth_github'", user.id)).toBe(1);
    expect(await sessionsOf(user.id)).toBe(1);
  });

  it("the same account again is a success without a second audit row", async () => {
    await enableProvider("github");
    const email = emailOf("lan");
    const id = identityOf();
    const { user } = await linkedUser(email, "github", id);
    const { cookie } = await signIn(email);
    const audits = await linkAudits(user.id);
    const { res } = await comeBack("github", cookie, id);
    expect(res.headers.get("location")).toBe("/me?link=ok");
    expect(await identitiesOf(user.id)).toBe(1);
    expect(await linkAudits(user.id)).toBe(audits);
  });

  it("an account another user holds: 'taken', nothing changes, nobody is signed in, the owner is never named", async () => {
    await enableProvider("github");
    const id = identityOf();
    const owner = await linkedUser(emailOf("owner"), "github", id);
    const { user, cookie } = await signIn(emailOf("lan"));
    const ownerSessions = await sessionsOf(owner.user.id);
    const { res } = await comeBack("github", cookie, id);
    expectBack(res, "/me?link=taken");
    expect(await identitiesOf(user.id)).toBe(0);
    expect(await linkAudits(user.id)).toBe(0);
    expect(await sessionsOf(owner.user.id)).toBe(ownerSessions);
    expect(res.headers.getSetCookie().some((l) => l.startsWith("__Host-vnx_session="))).toBe(false);
    const page = await meHtml("/me?link=taken", cookie);
    expect(page).toContain("That account is already linked to another VNX.SI account");
    expect(page).toContain("contact@vnx.si");
    for (const secret of [owner.user.email, owner.user.id, id.subject, id.label]) {
      expect(page).not.toContain(secret);
      expect(logged().join("\n")).not.toContain(secret);
    }
    expect(loggedCodes()).toEqual(["link_conflict"]);
  });

  it("the 'taken' answer is the same whoever holds the account", async () => {
    await enableProvider("github");
    const a = identityOf();
    const b = identityOf();
    await linkedUser(emailOf("alice"), "github", a);
    await linkedUser(emailOf("bob"), "github", b);
    const { cookie } = await signIn(emailOf("lan"));
    const first = (await comeBack("github", cookie, a)).res;
    const second = (await comeBack("github", cookie, b)).res;
    expect(first.headers.get("location")).toBe("/me?link=taken");
    expect(second.headers.get("location")).toBe("/me?link=taken");
  });

  it("a user who already has another account of that provider gets 'hasProvider' and keeps the old one", async () => {
    await enableProvider("github");
    const email = emailOf("lan");
    const old = identityOf();
    const { user } = await linkedUser(email, "github", old);
    const { cookie } = await signIn(email);
    const { res } = await comeBack("github", cookie, identityOf());
    expectBack(res, "/me?link=hasProvider");
    expect(await identitiesOf(user.id)).toBe(1);
    expect((await testEnv.DB.prepare("SELECT provider_subject AS s FROM user_identities WHERE user_id = ?1").bind(user.id).first<{ s: string }>())?.s).toBe(old.subject);
  });

  it("refuses when the session is not the one that asked: no exchange, no link, generic error page, cookie cleared", async () => {
    await enableProvider("github");
    const lan = await signIn(emailOf("lan"));
    const minh = await signIn(emailOf("minh"));
    const link = await linkViaStart("github", lan.cookie);
    if (!link.flow) throw new Error("no link flow");
    const code = issueFakeCode("github", identityOf(), { verifier: link.flow.verifier, nonce: link.flow.nonce, redirectUri: redirectUri("github") });
    spies.forEach((s) => s.mockClear());
    for (const session of [`${minh.cookie}; `, ""]) {
      const res = await callbackReq("github", { code, state: link.flow.state }, `${session}${link.flowCookie}`);
      expect(res.status).toBe(400);
      expect(res.headers.get("location")).toBeNull();
      expect(clearedOAuthCookie(res)).not.toBeNull();
    }
    expect(await identitiesOf(lan.user.id)).toBe(0);
    expect(await identitiesOf(minh.user.id)).toBe(0);
    expect(loggedCodes()).toEqual(["session_mismatch", "session_mismatch"]);
    // The code was never spent: the right session can still use it.
    const again = await callbackReq("github", { code, state: link.flow.state }, `${lan.cookie}; ${link.flowCookie}`);
    expect(again.headers.get("location")).toBe("/me?link=ok");
  });

  it("refuses when the session expired between start and callback", async () => {
    await enableProvider("github");
    const { user, cookie } = await signIn(emailOf("lan"));
    const link = await linkViaStart("github", cookie);
    if (!link.flow) throw new Error("no link flow");
    await testEnv.DB.prepare("UPDATE sessions SET expires_at = ?2 WHERE user_id = ?1").bind(user.id, "2020-01-01T00:00:00.000Z").run();
    const code = issueFakeCode("github", identityOf(), { verifier: link.flow.verifier, nonce: link.flow.nonce, redirectUri: redirectUri("github") });
    spies.forEach((s) => s.mockClear());
    const res = await callbackReq("github", { code, state: link.flow.state }, `${cookie}; ${link.flowCookie}`);
    expect(res.status).toBe(400);
    expect(await identitiesOf(user.id)).toBe(0);
    expect(loggedCodes()).toEqual(["session_mismatch"]);
    // The code was never spent: with the session alive again, the same code still links.
    await testEnv.DB.prepare("UPDATE sessions SET expires_at = ?2 WHERE user_id = ?1").bind(user.id, "2999-01-01T00:00:00.000Z").run();
    const again = await callbackReq("github", { code, state: link.flow.state }, `${cookie}; ${link.flowCookie}`);
    expect(again.headers.get("location")).toBe("/me?link=ok");
  });

  it("a link flow whose hash is for another session is not accepted even with a valid state", async () => {
    await enableProvider("github");
    const { user, cookie } = await signIn(emailOf("lan"));
    const flow = newFlowCookie({ provider: "github", intent: "link", state: "s".repeat(43), verifier: "v".repeat(43), nonce: "n".repeat(43), next: null, locale: "en", sessionHash: await linkSessionHash("another-session") }, Date.now());
    const code = issueFakeCode("github", identityOf(), { verifier: flow.verifier, nonce: flow.nonce, redirectUri: redirectUri("github") });
    spies.forEach((s) => s.mockClear());
    const res = await callbackReq("github", { code, state: flow.state }, `${cookie}; ${OAUTH_COOKIE}=${encodeOAuthCookie(flow)}`);
    expect(res.status).toBe(400);
    expect(await identitiesOf(user.id)).toBe(0);
    expect(loggedCodes()).toEqual(["session_mismatch"]);
    // The code was never spent: the same flow bound to the real session redeems it.
    const right = newFlowCookie({ provider: "github", intent: "link", state: flow.state, verifier: flow.verifier, nonce: flow.nonce, next: null, locale: "en", sessionHash: await linkSessionHash(cookie.split("=")[1] ?? "") }, Date.now());
    const again = await callbackReq("github", { code, state: right.state }, `${cookie}; ${OAUTH_COOKIE}=${encodeOAuthCookie(right)}`);
    expect(again.headers.get("location")).toBe("/me?link=ok");
  });

  it("the provider's refusal and a bad code come back to /me with 'failed', one fixed log code each, cookie cleared", async () => {
    await enableProvider("github");
    const { user, cookie } = await signIn(emailOf("lan"));
    const denied = await linkViaStart("github", cookie);
    spies.forEach((s) => s.mockClear());
    const res = await callbackReq("github", { error: "access_denied", state: denied.flow?.state ?? "" }, `${cookie}; ${denied.flowCookie}`);
    expectBack(res, "/me?link=failed");
    const bad = await linkViaStart("github", cookie);
    const res2 = await callbackReq("github", { code: "no-such-code", state: bad.flow?.state ?? "" }, `${cookie}; ${bad.flowCookie}`);
    expectBack(res2, "/me?link=failed");
    expect(loggedCodes()).toEqual(["provider_denied", "token_request"]);
    expect(logged().join("\n")).not.toContain("no-such-code");
    expect(await identitiesOf(user.id)).toBe(0);
  });

  it("a wrong state is the generic page (it is not known to be a link yet) and links nothing", async () => {
    await enableProvider("github");
    const { user, cookie } = await signIn(emailOf("lan"));
    const link = await linkViaStart("github", cookie);
    const res = await callbackReq("github", { code: "x", state: "y".repeat(43) }, `${cookie}; ${link.flowCookie}`);
    expect(res.status).toBe(400);
    expect(await identitiesOf(user.id)).toBe(0);
  });

  it("does not look at the e-mail of the provider account: a matching users.email still links only the signed-in user", async () => {
    await enableProvider("google");
    const victim = await ensureUser(emailOf("victim"));
    const { user, cookie } = await signIn(emailOf("lan"));
    const { res } = await comeBack("google", cookie, { subject: `sub-${tag()}`, label: victim.email });
    expect(res.headers.get("location")).toBe("/me?link=ok");
    expect(await identitiesOf(user.id)).toBe(1);
    expect(await identitiesOf(victim.id)).toBe(0);
  });
});

describe("/me notices for ?link= (VNX-2605a-2)", () => {
  it.each([
    ["/me", "ok", "Account linked. You can now sign in with it."],
    ["/vi/me", "taken", "Tài khoản đó đã được liên kết với một tài khoản VNX.SI khác nên không thể liên kết ở đây."],
    ["/zh-hans/me", "hasProvider", "你的 VNX.SI 账户已关联该平台的另一个账号。"],
    ["/zh-hant/me", "failed", "無法連結該帳號，請再試一次。"],
    ["/me", "unlinked", "Account unlinked. You can still sign in with an email link."],
    ["/vi/me", "notLinked", "Tài khoản đó chưa được liên kết nên không có gì thay đổi."],
  ])("%s?link=%s shows its message in the identities section", async (path, value, text) => {
    await enableProvider("github");
    resetFlagCache();
    const { cookie } = await signIn(emailOf("lan"));
    const html = await meHtml(`${path}?link=${value}`, cookie);
    expect(html.match(/<section id="identities">.*?<\/section>/s)?.[0]).toContain(text);
  });

  it("shows nothing for an unknown value and reflects nothing", async () => {
    await enableProvider("github");
    resetFlagCache();
    const { cookie } = await signIn(emailOf("lan"));
    const html = await meHtml("/me?link=%3Cb%3Eevil%3C/b%3E", cookie);
    expect(html).toContain('<section id="identities"');
    expect(html).not.toContain("evil");
    expect(html).not.toContain('class="notice');
    expect(await meHtml("/me", cookie)).not.toContain('role="status"');
  });
});

describe("the 'account linked' e-mail (VNX-2605b)", () => {
  const mailTo = (address: string) => outbox.filter((m) => m.to === address);

  it("a new link sends exactly one e-mail, to users.email, with provider, label and the audited UTC time", async () => {
    await enableProvider("github");
    const email = emailOf("lan");
    const { user, cookie } = await signIn(email);
    const identity = { subject: `sub-${tag()}`, label: `l-${tag()}@gmail.example` }; // e-mail-shaped label
    const { res } = await comeBack("github", cookie, identity);
    expectBack(res, "/me?link=ok");
    const mails = mailTo(email);
    expect(mails).toHaveLength(1);
    expect(mails[0]?.to).toBe(email);
    expect(outbox).toHaveLength(1); // nothing to the label or anyone else
    expect(mails[0]?.subject).toBe("GitHub was linked to your VNX.SI account");
    expect(mails[0]?.text).toContain(identity.label);
    const row = await testEnv.DB.prepare("SELECT linked_at FROM user_identities WHERE user_id = ?1").bind(user.id).first<{ linked_at: string }>();
    expect(mails[0]?.text).toContain(formatUtc(row?.linked_at ?? ""));
    expect(mails[0]?.text).toContain("contact@vnx.si");
  });

  it("is in users.locale", async () => {
    await enableProvider("github");
    const email = emailOf("lan");
    const { cookie } = await signIn(email, { locale: "zh-Hant" });
    await comeBack("github", cookie, identityOf(), "/vi");
    expect(mailTo(email)[0]?.subject).toBe("GitHub 已連結到你的 VNX.SI 帳戶");
  });

  it("the same account again sends nothing (already_linked changes nothing)", async () => {
    await enableProvider("github");
    const email = emailOf("lan");
    const { user, cookie } = await signIn(email);
    const identity = identityOf();
    await comeBack("github", cookie, identity);
    const { res: res2 } = await comeBack("github", cookie, identity);
    expectBack(res2, "/me?link=ok");
    expect(await linkAudits(user.id)).toBe(1);
    expect(mailTo(email)).toHaveLength(1);
  });

  it("a conflict ('taken', 'hasProvider') sends nothing to anyone", async () => {
    await enableProvider("github");
    const shared = identityOf();
    await linkedUser(emailOf("holder"), "github", shared);
    const { cookie } = await signIn(emailOf("lan"));
    expectBack((await comeBack("github", cookie, shared)).res, "/me?link=taken");
    const mine = emailOf("mine");
    await linkedUser(mine, "github", identityOf());
    const { cookie: mineCookie } = await signIn(mine);
    expectBack((await comeBack("github", mineCookie, identityOf())).res, "/me?link=hasProvider");
    expect(outbox).toHaveLength(0);
  });

  it("a failing mailer keeps the link and the audit; one fixed log code, nothing else", async () => {
    await enableProvider("github");
    const email = emailOf("lan");
    const { user, cookie } = await signIn(email);
    const identity = identityOf();
    const send = vi.spyOn(FakeMailer.prototype, "send").mockRejectedValue(new Error(`boom ${email} ${identity.label} token=SECRET`));
    const { res } = await comeBack("github", cookie, identity);
    send.mockRestore(); // only this spy: `vi.restoreAllMocks()` would also drop the console spies the log assertions need
    expectBack(res, "/me?link=ok");
    expect(await identitiesOf(user.id)).toBe(1);
    expect(await linkAudits(user.id)).toBe(1);
    expect(loggedCodes()).toEqual(["notify_failed"]);
    expect(Object.keys(JSON.parse(logged()[0] ?? "")).sort()).toEqual(["code", "event", "kind", "provider", "requestId"]);
    for (const line of logged()) for (const secret of [email, identity.label, "boom", "SECRET"]) expect(line).not.toContain(secret);
  });

  it("carries no state, verifier, nonce, code or session id, and no action link", async () => {
    await enableProvider("github");
    const email = emailOf("lan");
    const { cookie } = await signIn(email);
    const { link, code } = await comeBack("github", cookie, identityOf());
    const mail = mailTo(email)[0];
    const body = `${mail?.text}\n${mail?.html}`;
    for (const secret of [link.flow?.state, link.flow?.verifier, link.flow?.nonce, code, cookie.split("=")[1]]) expect(body).not.toContain(secret ?? "x");
    expect(body).not.toMatch(/[?&]t=|token=|code=|state=|\/auth\//i);
    expect([...new Set(body.match(/https?:\/\/[^\s"<]+/g) ?? [])]).toEqual([`${testEnv.APP_ORIGIN}/me`]);
  });
});
