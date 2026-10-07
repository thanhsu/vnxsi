import { jsx } from "hono/jsx";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.ts";
import type { Bindings } from "../../src/env.ts";
import { localizedPath } from "../../src/i18n/locales.ts";
import { Layout } from "../../src/views/Layout.tsx";
import { withPrivacyNoticeRequest } from "../../src/views/privacy-notice.tsx";
import { makeBuilder, signIn } from "../fixtures.ts";
import { getReq, testEnv } from "../helpers.ts";

const app = createApp();
const LIVE_ENV = { ...testEnv, PRIVACY_NOTICE_GO_LIVE: "2026-10-20" } as Bindings;
const get = (path: string, cookie?: string, env: Bindings = LIVE_ENV) => app.request(getReq(path, cookie), undefined, env);
const page = async (path: string, cookie?: string, env: Bindings = LIVE_ENV) => (await get(path, cookie, env)).text();
const NOTICE = 'data-privacy-notice="true"';
const NOTICE_SCRIPT = '<script src="/assets/privacy-notice.js" defer=""></script>'; // hono renders boolean attributes as defer="" (re-review M1)
const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;
const freeze = (iso: string) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
};

afterEach(() => vi.useRealTimers());

describe("SSR visibility", () => {
  it("shows the notice only for signed-in pages in the inclusive window", async () => {
    freeze("2026-10-20T00:00:00Z");
    const { cookie } = await signIn("privacy-notice-layout@vnx.si");
    const signedOut = await page("/products");
    const signedIn = await page("/vi/products", cookie);
    expect(signedOut).not.toContain(NOTICE);
    expect(signedOut).not.toContain("privacy-notice.js");
    expect(signedIn).toContain(NOTICE);
    expect(signedIn).toContain(`href="${localizedPath("vi", "/privacy")}"`);
    expect(count(signedIn, NOTICE_SCRIPT)).toBe(1);
  });

  it.each(["2026-10-05T23:59:59.999Z", "2026-11-20T00:00:00Z"])("hides outside the window at %s", async (iso) => {
    freeze(iso);
    const { cookie } = await signIn(`privacy-notice-edge-${iso.replace(/\D/g, "")}@vnx.si`);
    const html = await page("/products", cookie);
    expect(html).not.toContain(NOTICE);
    expect(html).not.toContain("privacy-notice.js");
  });

  it("covers /me, /hub, /admin through the one choke point and hides for unset/malformed bindings", async () => {
    freeze("2026-10-20T00:00:00Z");
    await makeBuilder("privacy-notice-builder@vnx.si", "privacy-notice-builder");
    const { cookie } = await signIn("privacy-notice-builder@vnx.si");
    const { cookie: adminCookie } = await signIn("owner@vnx.si", { admin: true });
    expect(await page("/me", cookie)).toContain(NOTICE);
    expect(await page("/hub", cookie)).toContain(NOTICE);
    expect(await page("/admin/builders", adminCookie)).toContain(NOTICE);
    const bad = { ...LIVE_ENV, PRIVACY_NOTICE_GO_LIVE: "2026-02-30" } as Bindings;
    expect(await page("/products", cookie, bad)).not.toContain(NOTICE);
    expect(await page("/products", cookie, { ...LIVE_ENV, PRIVACY_NOTICE_GO_LIVE: undefined } as Bindings)).not.toContain(NOTICE);
  });

  it("landing keeps landing.js once, adds the notice script once, and wraps the notice in .container", async () => {
    freeze("2026-10-20T00:00:00Z");
    const { cookie } = await signIn("privacy-notice-landing@vnx.si");
    const html = await page("/", cookie);
    expect(count(html, '<script src="/assets/landing.js" defer=""></script>')).toBe(1);
    expect(count(html, NOTICE_SCRIPT)).toBe(1);
    expect(html).toMatch(/<main id="main" class="page-full"><div class="container"><details class="privacy-notice"/);
  });

  it("keeps the SSR notice open, first in <main>, with a native close and a locale link", async () => {
    freeze("2026-10-20T00:00:00Z");
    const { cookie } = await signIn("privacy-notice-no-js@vnx.si");
    const html = await page("/products", cookie);
    expect(html).toMatch(/<main id="main" class="container"><details class="privacy-notice"[^>]*\bopen\b/);
    expect(html).toContain("privacy-notice-close");
    expect(html).toContain(localizedPath("en", "/privacy"));
  });
});

describe("request context default", () => {
  const props = { locale: "en", title: "t", origin: "https://vnx.si", rest: "/", signedIn: true, children: null } as const;

  it("a Layout rendered outside page() never shows the notice, even inside the window", () => {
    freeze("2026-10-20T00:00:00Z");
    expect(String(jsx(Layout, props))).not.toContain("data-privacy-notice");
  });

  it("the same Layout does show it once the request context is provided (the gate is the context)", () => {
    const html = String(withPrivacyNoticeRequest({ goLive: "2026-10-20", now: new Date("2026-10-20T00:00:00Z") }, jsx(Layout, props)));
    expect(html).toContain(NOTICE);
  });
});
