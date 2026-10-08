import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { resetFlagCache } from "../../src/db/flags.ts";
import { OAUTH_PROVIDERS, PROVIDER_NAME, type OAuthProvider } from "../../src/domain/identity.ts";
import type { Bindings } from "../../src/env.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";
import { enableProvider, startOAuth } from "../oauth-flow.ts";

const withoutCredentials = { ...testEnv, OAUTH_DRIVER: undefined } as Bindings;
const BLOCK = /<div class="oauth">.*?<\/div>/s;
const LINK = /<a [^>]*href="(\/auth\/oauth\/[^"]+)"[^>]*>([^<]*)<\/a>/g;

beforeEach(async () => {
  await testEnv.DB.prepare("DELETE FROM feature_flags WHERE key LIKE 'oauth_%'").run();
  resetFlagCache();
});

async function loginHtml(path = "/login", env: Bindings = testEnv): Promise<{ res: Response; html: string }> {
  const res = await createApp().request(getReq(path), undefined, env);
  return { res, html: await res.text() };
}

/** Every link to /auth/oauth/ on the page: its URL (entities decoded, as a browser does) and its text. */
function oauthLinks(html: string) {
  return [...html.matchAll(LINK)].map((m) => ({ href: (m[1] ?? "").replaceAll("&amp;", "&"), text: m[2] ?? "" }));
}

async function enableAll() {
  for (const p of OAUTH_PROVIDERS) await enableProvider(p);
  resetFlagCache();
}

describe("/login provider buttons (VNX-2604c)", () => {
  it("shows no button, and the same bytes, while the three flags are off", async () => {
    for (const path of ["/login", "/vi/login", "/zh-hans/login", "/zh-hant/login"]) {
      const { res, html } = await loginHtml(path);
      expect(res.status).toBe(200);
      expect(html, path).not.toContain("/auth/oauth/");
      expect(html, path).not.toContain("oauth");
      // Nothing between the form and the end of the card: the page is the one VNX-0506 shipped.
      expect(html, path).toMatch(/<\/button><\/form><\/section>/);
    }
  });

  it("with every flag on, the page minus the block is the flags-off page", async () => {
    const off = (await loginHtml("/vi/login?next=/hub")).html;
    await enableAll();
    const on = (await loginHtml("/vi/login?next=/hub")).html;
    expect(on).toMatch(BLOCK);
    expect(on.replace(BLOCK, "")).toBe(off);
  });

  it.each(OAUTH_PROVIDERS)("%s: button only when its own flag is on", async (provider: OAuthProvider) => {
    expect(oauthLinks((await loginHtml()).html)).toEqual([]);
    await enableProvider(provider);
    resetFlagCache();
    const links = oauthLinks((await loginHtml()).html);
    expect(links).toHaveLength(1);
    expect(links[0]?.href.startsWith(`/auth/oauth/${provider}/start?`)).toBe(true);
    expect(links[0]?.text).toBe(`Sign in with ${PROVIDER_NAME[provider]}`);
  });

  it.each(OAUTH_PROVIDERS)("%s: flag on but no credentials means no button (decision 6)", async (provider: OAuthProvider) => {
    await enableProvider(provider);
    resetFlagCache();
    expect(oauthLinks((await loginHtml("/login", withoutCredentials)).html)).toEqual([]);
    expect(oauthLinks((await loginHtml("/login", testEnv)).html)).toHaveLength(1);
  });

  it("all on: three plain links in catalogue order, below the e-mail form, and no form posts to /auth/oauth/", async () => {
    await enableAll();
    const { html } = await loginHtml();
    expect(oauthLinks(html).map((l) => l.text)).toEqual(["Sign in with Google", "Sign in with GitHub", "Sign in with LinkedIn"]);
    expect(html.indexOf("</form>")).toBeLessThan(html.indexOf('class="oauth"'));
    const forms = [...html.matchAll(/<form\b[^>]*>/g)].map((m) => m[0]);
    expect(forms).toHaveLength(1);
    expect(forms[0]).toContain('action="/login"');
    expect(forms.some((f) => f.includes("/auth/oauth/"))).toBe(false);
    expect(html).toContain('<p class="oauth-or">or</p>');
  });

  it("sends the Locale id as lang, and start reads it back, in all four locales", async () => {
    await enableProvider("github");
    resetFlagCache();
    const cases = [["/login", "en"], ["/vi/login", "vi"], ["/zh-hans/login", "zh-Hans"], ["/zh-hant/login", "zh-Hant"]] as const;
    for (const [path, lang] of cases) {
      const link = oauthLinks((await loginHtml(path)).html)[0];
      const url = new URL(link?.href ?? "", "https://vnx.si");
      expect(url.searchParams.get("lang"), path).toBe(lang);
      expect((await startOAuth("github", url.search)).flow.locale, path).toBe(lang);
    }
  });

  it("passes a safe next, URL-encoded, through to the flow; drops an unsafe one", async () => {
    await enableProvider("google");
    resetFlagCache();
    const next = "/hub?a=1&b=2";
    const link = oauthLinks((await loginHtml(`/login?next=${encodeURIComponent(next)}`)).html)[0];
    expect(link?.href).toBe(`/auth/oauth/google/start?lang=en&next=${encodeURIComponent(next)}`);
    expect((await startOAuth("google", new URL(link?.href ?? "", "https://vnx.si").search)).flow.next).toBe(next);

    for (const bad of ["//evil.example", "https://evil.example/x", "/\\evil", "javascript:alert(1)"]) {
      const l = oauthLinks((await loginHtml(`/login?next=${encodeURIComponent(bad)}`)).html)[0];
      expect(l?.href, bad).toBe("/auth/oauth/google/start?lang=en");
    }
  });

  it("keeps the buttons on the error page of a bad e-mail (POST /login, 400)", async () => {
    await enableProvider("linkedin");
    resetFlagCache();
    const res = await createApp().request(formPost("/vi/login", { email: "not-an-email", next: "/hub" }), undefined, testEnv);
    expect(res.status).toBe(400);
    const links = oauthLinks(await res.text());
    expect(links).toHaveLength(1);
    expect(links[0]?.text).toBe("Đăng nhập bằng LinkedIn");
    expect(links[0]?.href).toBe("/auth/oauth/linkedin/start?lang=vi&next=%2Fhub");
  });

  it("keeps the buttons on the rate-limited page (POST /login, 429)", async () => {
    await enableProvider("github");
    resetFlagCache();
    const statuses: number[] = [];
    let last = "";
    for (let i = 0; i < 6; i++) {
      const res = await createApp().request(formPost("/login", { email: "flood-oauth@vnx.si" }), undefined, testEnv);
      statuses.push(res.status);
      last = await res.text();
    }
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
    expect(oauthLinks(last)).toHaveLength(1);
  });

  it("is accessible and CSP-clean: button class, provider in the name, no inline style, script, image or svg", async () => {
    await enableAll();
    const { res, html } = await loginHtml();
    const block = BLOCK.exec(html)?.[0] ?? "";
    expect(block).toContain('class="btn btn-ghost"');
    for (const p of OAUTH_PROVIDERS) expect(block).toContain(PROVIDER_NAME[p]);
    expect(block).not.toMatch(/style=|<script|<img|<svg|\son\w+=|<form|<button/i);
    const csp = res.headers.get("content-security-policy") ?? "";
    // A reminder for VNX-2604d: official logos are self-hosted <img>, so img-src must stay 'self'.
    expect(csp).toContain("img-src 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it("states the text in all four locales", async () => {
    await enableProvider("github");
    resetFlagCache();
    const expected = { "/login": ["Sign in with GitHub", "or"], "/vi/login": ["Đăng nhập bằng GitHub", "hoặc"], "/zh-hans/login": ["使用 GitHub 账号登录", "或"], "/zh-hant/login": ["使用 GitHub 帳號登入", "或"] } as const;
    for (const [path, [label, or]] of Object.entries(expected)) {
      const { html } = await loginHtml(path);
      expect(oauthLinks(html)[0]?.text, path).toBe(label);
      expect(html, path).toContain(`<p class="oauth-or">${or}</p>`);
    }
  });
});
