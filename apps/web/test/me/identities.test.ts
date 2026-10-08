import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { linkSessionHash, OAUTH_COOKIE } from "../../src/auth/oauth-cookie.ts";
import { resetFlagCache } from "../../src/db/flags.ts";
import { parseOAuthCookie } from "../../src/domain/oauth.ts";
import type { Bindings } from "../../src/env.ts";
import { signIn } from "../fixtures.ts";
import { formPost, getReq, setCookieValue, testEnv } from "../helpers.ts";
import { enableProvider, linkedUser } from "../oauth-flow.ts";

let counter = 0;
const tag = () => `${++counter}-${Math.random().toString(36).slice(2, 8)}`;
const emailOf = (who: string) => `${who}-${tag()}@example.com`;
const withoutCredentials = { ...testEnv, OAUTH_DRIVER: undefined } as Bindings;
/** Hono escapes & ' " < >; a browser shows the characters (pattern of test/landing/page.test.ts). */
const decode = (s: string) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

beforeEach(async () => {
  await testEnv.DB.prepare("DELETE FROM feature_flags WHERE key LIKE 'oauth_%'").run();
  resetFlagCache();
});

async function meHtml(cookie: string, path = "/me", env: Bindings = testEnv) {
  const res = await createApp().request(getReq(path, cookie), undefined, env);
  return { res, html: decode(await res.text()) };
}
const sectionOf = (html: string) => html.match(/<section id="identities">.*?<\/section>/s)?.[0] ?? "";
const rowsOf = (html: string) => sectionOf(html).match(/<tr>.*?<\/tr>/gs) ?? [];
const postLink = (provider: string, cookie: string, path = `/me/identities/${provider}/link`, headers: Record<string, string> = {}) =>
  createApp().request(formPost(path, {}, { cookie, ...headers }), undefined, testEnv);

describe("/me: Sign-in & linked accounts (VNX-2605a-1; visibility decided by the Owner 2026-10-08)", () => {
  it("is absent while every flag is off and the user has no linked account", async () => {
    for (const method of ["magic_link", "oauth_github"] as const) {
      const { cookie } = await signIn(emailOf("lan"), { method });
      const { res, html } = await meHtml(cookie);
      expect(res.status).toBe(200);
      expect(html).not.toContain('id="identities"');
      expect(html).not.toContain("Sign-in & linked accounts");
      expect(html).not.toContain("/identities/");
    }
  });

  it("one flag on: the section shows only that provider, with its Link button (every signed-in user)", async () => {
    await enableProvider("github");
    resetFlagCache();
    for (const method of ["magic_link", "oauth_google"] as const) {
      const { cookie } = await signIn(emailOf("lan"), { method });
      const html = (await meHtml(cookie)).html;
      expect(sectionOf(html)).toContain("Sign-in & linked accounts");
      const rows = rowsOf(html);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toContain("GitHub");
      expect(rows[0]).toContain("Not linked");
      expect(rows[0]).toContain('action="/me/identities/github/link"');
      expect(rows[0]).toContain('method="post"');
      expect(rows[0]).toContain("Link GitHub");
    }
  });

  it("a flag on but the provider not configured: not available, so no section", async () => {
    await enableProvider("github");
    resetFlagCache();
    const { cookie } = await signIn(emailOf("lan"));
    const html = (await meHtml(cookie, "/me", withoutCredentials)).html;
    expect(html).not.toContain('id="identities"');
  });

  it("every flag off and one linked account: the section shows only that row, with the label and no Link button", async () => {
    const label = `lan-${tag()}@gmail.example`;
    const email = emailOf("lan");
    await linkedUser(email, "google", { subject: `sub-${tag()}`, label });
    const { cookie } = await signIn(email);
    const html = (await meHtml(cookie)).html;
    const rows = rowsOf(html);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain("Google");
    expect(rows[0]).toContain("Linked");
    expect(rows[0]).toContain(label);
    expect(sectionOf(html)).not.toContain("<form");
    expect(rows[0]).not.toContain("GitHub"); // the intro names all three providers, so look at the row only
    const { cookie: other } = await signIn(emailOf("minh"));
    expect((await meHtml(other)).html).not.toContain(label);
  });

  it("a linked provider whose flag is off stays visible next to a linkable one, in catalogue order", async () => {
    const email = emailOf("lan");
    await linkedUser(email, "linkedin", { subject: `sub-${tag()}`, label: "LinkedIn" });
    await enableProvider("github");
    resetFlagCache();
    const { cookie } = await signIn(email);
    const rows = rowsOf((await meHtml(cookie)).html);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain("GitHub");
    expect(rows[0]).toContain("Link GitHub");
    expect(rows[1]).toContain("LinkedIn");
    expect(rows[1]).toContain("Linked");
    expect(rows[1]).not.toContain("<form");
  });

  it("a label equal to the provider name is not repeated, and unlink is Task 9's: nothing mentions it", async () => {
    const email = emailOf("lan");
    await linkedUser(email, "linkedin", { subject: `sub-${tag()}`, label: "LinkedIn" });
    const { cookie } = await signIn(email);
    const html = (await meHtml(cookie)).html;
    expect((rowsOf(html)[0] ?? "").match(/LinkedIn/g)).toHaveLength(1);
    expect(sectionOf(html)).not.toContain("unlink");
  });

  it("is localized in all four locales, and /me is not no-referrer", async () => {
    await enableProvider("github");
    resetFlagCache();
    const { cookie } = await signIn(emailOf("lan"));
    const titles: Array<[string, string]> = [["/me", "Sign-in & linked accounts"], ["/vi/me", "Đăng nhập & tài khoản liên kết"], ["/zh-hans/me", "登录与关联账号"], ["/zh-hant/me", "登入與連結帳號"]];
    for (const [path, title] of titles) {
      const { res, html } = await meHtml(cookie, path);
      expect(sectionOf(html), path).toContain(title);
      expect(res.headers.get("referrer-policy")).not.toBe("no-referrer");
    }
  });
});

describe("POST /me/identities/:provider/link (VNX-2605a-1)", () => {
  it("303 to the same-site start, with an intent cookie bound to this session and living at most 120 s", async () => {
    await enableProvider("github");
    const { cookie } = await signIn(emailOf("lan"));
    const res = await postLink("github", cookie);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/auth/oauth/github/start?lang=en");
    const raw = setCookieValue(res, OAUTH_COOKIE) ?? "";
    const intent = parseOAuthCookie(raw, { provider: "github", now: Date.now() });
    if (intent?.phase !== "intent") throw new Error("no intent cookie");
    expect(intent.intent).toBe("link");
    expect(intent.sessionHash).toBe(await linkSessionHash(cookie.split("=")[1] ?? ""));
    expect(intent.exp - Date.now()).toBeLessThanOrEqual(120_000);
    const line = res.headers.getSetCookie().find((l) => l.startsWith(`${OAUTH_COOKIE}=`)) ?? "";
    expect(line).toMatch(/HttpOnly/i);
    expect(line).toMatch(/Secure/i);
    expect(line).toMatch(/SameSite=Lax/i);
    expect(line).toMatch(/Path=\//);
    expect(Number(/Max-Age=(\d+)/i.exec(line)?.[1])).toBeLessThanOrEqual(120);
  });

  it.each([["/vi/me", "vi"], ["/zh-hans/me", "zh-Hans"], ["/zh-hant/me", "zh-Hant"]])("%s: lang is the Locale id", async (prefix, lang) => {
    await enableProvider("google");
    const { cookie } = await signIn(emailOf("lan"));
    const res = await postLink("google", cookie, `${prefix}/identities/google/link`);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`/auth/oauth/google/start?lang=${lang}`);
  });

  it("never redirects off-site: the Location is a path on this site, whatever the request", async () => {
    await enableProvider("github");
    const { cookie } = await signIn(emailOf("lan"));
    const res = await postLink("github", cookie, "/me/identities/github/link?next=https://evil.example&redirect=//evil.example");
    const location = res.headers.get("location") ?? "";
    expect(location.startsWith("/auth/oauth/github/start")).toBe(true);
    expect(location.startsWith("//")).toBe(false);
    expect(location).not.toContain("evil");
  });

  it("refuses a missing or foreign Origin (403) and writes no cookie", async () => {
    await enableProvider("github");
    const { cookie } = await signIn(emailOf("lan"));
    for (const headers of [{ origin: "https://evil.example" }, { origin: "null" }]) {
      const res = await postLink("github", cookie, "/me/identities/github/link", headers);
      expect(res.status).toBe(403);
      expect(setCookieValue(res, OAUTH_COOKIE)).toBeNull();
    }
    const noOrigin = await createApp().request(new Request("https://vnx.si/me/identities/github/link", { method: "POST", headers: { cookie } }), undefined, testEnv);
    expect(noOrigin.status).toBe(403);
    expect(setCookieValue(noOrigin, OAUTH_COOKIE)).toBeNull();
  });

  it("is 404 with no cookie when the flag is off, the provider is not configured, or the name is not a provider", async () => {
    const { cookie } = await signIn(emailOf("lan"));
    expect((await postLink("github", cookie)).status).toBe(404);
    await enableProvider("github");
    resetFlagCache();
    const unconfigured = await createApp().request(formPost("/me/identities/github/link", {}, { cookie }), undefined, withoutCredentials);
    expect(unconfigured.status).toBe(404);
    expect(setCookieValue(unconfigured, OAUTH_COOKIE)).toBeNull();
    expect((await postLink("facebook", cookie)).status).toBe(404);
    expect((await postLink("google", cookie)).status).toBe(404);
  });

  it("needs a session: signed out goes to /login and no OAuth cookie is written", async () => {
    await enableProvider("github");
    const res = await createApp().request(formPost("/me/identities/github/link", {}), undefined, testEnv);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/login");
    expect(setCookieValue(res, OAUTH_COOKIE)).toBeNull();
  });

  it("keeps the 64 KB body limit", async () => {
    await enableProvider("github");
    const { cookie } = await signIn(emailOf("lan"));
    const big = new Request("https://vnx.si/me/identities/github/link", {
      method: "POST",
      headers: { origin: "https://vnx.si", cookie, "content-type": "application/x-www-form-urlencoded" },
      body: `x=${"a".repeat(70 * 1024)}`,
    });
    expect((await createApp().request(big, undefined, testEnv)).status).toBe(413);
  });
});
