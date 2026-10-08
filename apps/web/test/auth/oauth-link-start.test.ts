import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.ts";
import { linkSessionHash, OAUTH_COOKIE } from "../../src/auth/oauth-cookie.ts";
import { resetFakeOAuth } from "../../src/auth/oauth/fake.ts";
import { resetFlagCache } from "../../src/db/flags.ts";
import { OAUTH_PROVIDERS, PROVIDER_NAME } from "../../src/domain/identity.ts";
import { OAUTH_PROVIDER_SPECS, parseOAuthCookie } from "../../src/domain/oauth.ts";
import { signIn } from "../fixtures.ts";
import { getReq, setCookieValue, testEnv } from "../helpers.ts";
import { enableProvider, externalLinks, linkViaStart, startOAuth } from "../oauth-flow.ts";

let counter = 0;
const emailOf = (who: string) => `${who}-${++counter}-${Math.random().toString(36).slice(2, 8)}@example.com`;

beforeEach(async () => {
  resetFakeOAuth();
  await testEnv.DB.prepare("DELETE FROM feature_flags WHERE key LIKE 'oauth_%'").run();
  resetFlagCache();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("start with a link intent: the intermediate page (decision 14, R3; Review Focus 12)", () => {
  it.each(OAUTH_PROVIDERS)("%s: POST answers 303, then start answers 200, never a 3xx, with one plain link to the provider and no form but the logout one", async (provider) => {
    await enableProvider(provider);
    const { cookie } = await signIn(emailOf("lan"));
    const linked = await linkViaStart(provider, cookie);
    expect(linked.post.status).toBe(303);
    expect(linked.start.status).toBe(200);
    expect(linked.start.headers.get("location")).toBeNull();
    const links = externalLinks(linked.html);
    expect(links).toHaveLength(1);
    expect(links[0]?.origin).toBe(new URL(OAUTH_PROVIDER_SPECS[provider].authorizeUrl).origin);
    expect(links[0]?.searchParams.get("state")).toBe(linked.flow?.state);
    expect(links[0]?.searchParams.get("redirect_uri")).toBe(`${testEnv.APP_ORIGIN}/auth/oauth/${provider}/callback`);
    // The page is signed in, so Layout adds its logout form; no other form, none off-site, none towards /auth/oauth/.
    const actions = [...linked.html.matchAll(/<form\b[^>]*\baction="([^"]*)"/g)].map((m) => m[1] ?? "");
    expect((linked.html.match(/<form\b/g) ?? []).length).toBe(actions.length);
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.every((a) => a === "/logout")).toBe(true);
    expect(linked.html).toContain('action="/logout"');
    expect(linked.html).toContain(`Link ${PROVIDER_NAME[provider]}`);
    expect(linked.html).toContain(`Continue to ${PROVIDER_NAME[provider]}`);
  });

  it("is hardened: no-store, Referrer-Policy same-origin, no inline script or style", async () => {
    await enableProvider("github");
    const { cookie } = await signIn(emailOf("lan"));
    const { start, html } = await linkViaStart("github", cookie);
    expect(start.headers.get("cache-control")).toBe("no-store");
    expect(start.headers.get("referrer-policy")).toBe("same-origin");
    expect(html).not.toMatch(/<script\b/i);
    expect(html).not.toMatch(/\sstyle=/i);
    expect(html).not.toMatch(/\son[a-z]+=/i);
    expect(html).not.toMatch(/http-equiv="refresh"/i);
  });

  it("writes a link flow cookie bound to this session, with no next, and the locale of lang", async () => {
    await enableProvider("github");
    const { cookie } = await signIn(emailOf("lan"));
    const linked = await linkViaStart("github", cookie, { extraQuery: "&next=/hub" });
    expect(linked.flow).toMatchObject({ phase: "flow", intent: "link", provider: "github", next: null, locale: "en" });
    expect(linked.flow?.sessionHash).toBe(await linkSessionHash(cookie.split("=")[1] ?? ""));
    expect(linked.flow?.state).toMatch(/^[A-Za-z0-9_-]{43,}$/);
  });

  it("is localized, and the provider name is not translated", async () => {
    await enableProvider("linkedin");
    const { cookie } = await signIn(emailOf("lan"));
    const expected: Array<[string, string, string]> = [["/vi/me", "Tiếp tục tới LinkedIn", "Liên kết LinkedIn"], ["/zh-hans/me", "继续前往 LinkedIn", "关联 LinkedIn 账号"], ["/zh-hant/me", "繼續前往 LinkedIn", "連結 LinkedIn 帳號"]];
    for (const [prefix, cta, title] of expected) {
      const post = await createApp().request(new Request(`https://vnx.si${prefix}/identities/linkedin/link`, { method: "POST", headers: { origin: "https://vnx.si", cookie } }), undefined, testEnv);
      const intent = setCookieValue(post, OAUTH_COOKIE) ?? "";
      const res = await createApp().request(getReq(post.headers.get("location") ?? "", `${cookie}; ${OAUTH_COOKIE}=${intent}`), undefined, testEnv);
      const html = await res.text();
      expect(html, prefix).toContain(cta);
      expect(html, prefix).toContain(title);
    }
  });

  it("no URL parameter chooses the intent: no intent cookie means a 302 sign-in, whatever the query", async () => {
    await enableProvider("github");
    const { cookie } = await signIn(emailOf("lan"));
    for (const query of ["?intent=link", "?link=1", "?mode=link&lang=en"]) {
      const res = await createApp().request(getReq(`/auth/oauth/github/start${query}`, cookie), undefined, testEnv);
      expect(res.status, query).toBe(302);
    }
    expect((await startOAuth("github", "?intent=link", cookie)).flow.intent).toBe("signin");
  });

  it("a link intent counts only for the session that asked, only for its provider, and only while the session lives", async () => {
    await enableProvider("github");
    await enableProvider("google");
    const lan = await signIn(emailOf("lan"));
    const minh = await signIn(emailOf("minh"));
    const raw = setCookieValue((await linkViaStart("github", lan.cookie)).post, OAUTH_COOKIE) ?? "";
    expect(raw).not.toBe("");
    // Another user's session carrying Lan's intent cookie.
    const other = await createApp().request(getReq("/auth/oauth/github/start", `${minh.cookie}; ${OAUTH_COOKIE}=${raw}`), undefined, testEnv);
    expect(other.status).toBe(302);
    // The right session, but a start for another provider.
    const wrongProvider = await createApp().request(getReq("/auth/oauth/google/start", `${lan.cookie}; ${OAUTH_COOKIE}=${raw}`), undefined, testEnv);
    expect(wrongProvider.status).toBe(302);
    // The right session after it expired (Task 2 LOW-2).
    await testEnv.DB.prepare("UPDATE sessions SET expires_at = ?2 WHERE user_id = ?1").bind(lan.user.id, "2020-01-01T00:00:00.000Z").run();
    const expired = await createApp().request(getReq("/auth/oauth/github/start", `${lan.cookie}; ${OAUTH_COOKIE}=${raw}`), undefined, testEnv);
    expect(expired.status).toBe(302);
  });

  it("signing in is unchanged: no session and no cookie still gets a 302 to the provider", async () => {
    await enableProvider("github");
    const started = await startOAuth("github");
    expect(started.res.status).toBe(302);
    expect(started.flow.intent).toBe("signin");
    expect(started.authorize.origin).toBe("https://github.com");
  });

  it("reloading the page (Back, refresh) shows it again with a fresh state: a live link flow of this session counts like an intent", async () => {
    await enableProvider("github");
    const { cookie } = await signIn(emailOf("lan"));
    const first = await linkViaStart("github", cookie);
    const reload = await createApp().request(getReq("/auth/oauth/github/start?lang=en", `${cookie}; ${first.flowCookie}`), undefined, testEnv);
    expect(reload.status).toBe(200);
    expect(reload.headers.get("location")).toBeNull();
    const raw = setCookieValue(reload, OAUTH_COOKIE) ?? "";
    const flow = parseOAuthCookie(raw, { provider: "github", now: Date.now() });
    if (flow?.phase !== "flow") throw new Error("no flow cookie");
    expect(flow).toMatchObject({ intent: "link", sessionHash: first.flow?.sessionHash });
    expect(flow.state).not.toBe(first.flow?.state);
    const links = externalLinks(await reload.text());
    expect(links).toHaveLength(1);
    expect(links[0]?.searchParams.get("state")).toBe(flow.state);
  });

  it("a sign-in flow cookie, another session's link flow, or an expired session is a 302 sign-in", async () => {
    await enableProvider("github");
    const lan = await signIn(emailOf("lan"));
    const minh = await signIn(emailOf("minh"));
    const signinFlow = await startOAuth("github");
    const signedIn = await createApp().request(getReq("/auth/oauth/github/start", `${lan.cookie}; ${signinFlow.cookie}`), undefined, testEnv);
    expect(signedIn.status, "signin flow cookie").toBe(302);
    const lansFlow = await linkViaStart("github", lan.cookie);
    expect(lansFlow.flow?.intent).toBe("link");
    const other = await createApp().request(getReq("/auth/oauth/github/start", `${minh.cookie}; ${lansFlow.flowCookie}`), undefined, testEnv);
    expect(other.status, "another session's link flow").toBe(302);
    await testEnv.DB.prepare("UPDATE sessions SET expires_at = ?2 WHERE user_id = ?1").bind(lan.user.id, "2020-01-01T00:00:00.000Z").run();
    const expired = await createApp().request(getReq("/auth/oauth/github/start", `${lan.cookie}; ${lansFlow.flowCookie}`), undefined, testEnv);
    expect(expired.status, "expired session").toBe(302);
  });
});
