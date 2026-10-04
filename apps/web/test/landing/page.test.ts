import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import type { Locale } from "../../src/i18n/locales.ts";
import { t } from "../../src/i18n/t.ts";
import { signIn } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const fetchAt = (url: string, cookie?: string) =>
  createApp().request(new Request(url, { headers: cookie ? { cookie } : {} }), undefined, testEnv);
const get = (path: string, cookie?: string) => fetchAt(`https://vnx.si${path}`, cookie);

const decode = (s: string) =>
  s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const mainOf = (html: string) => /<main[^>]*>([\s\S]*)<\/main>/.exec(html)?.[1] ?? "";
const textOf = (html: string) => decode(html.replace(/<[^>]*>/g, " "));
const jsonLd = (html: string) => JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/s.exec(html)?.[1] ?? "null");

const PAGES: { path: string; locale: Locale; canonical: string }[] = [
  { path: "/", locale: "en", canonical: "https://vnx.si/" },
  { path: "/vi", locale: "vi", canonical: "https://vnx.si/vi/" },
  { path: "/vi/", locale: "vi", canonical: "https://vnx.si/vi/" },
  { path: "/zh-hans", locale: "zh-Hans", canonical: "https://vnx.si/zh-hans/" },
  { path: "/zh-hant", locale: "zh-Hant", canonical: "https://vnx.si/zh-hant/" },
];

describe("landing page GET / (VNX-0708)", () => {
  it("AC1: renders the server landing in every locale, not the old static page", async () => {
    for (const { path, locale } of PAGES) {
      const res = await get(path);
      expect(res.status, path).toBe(200);
      expect(res.headers.get("content-type"), path).toContain("text/html");
      const html = await res.text();
      expect(html, path).toContain(`<html lang="${locale}">`);
      expect(textOf(html), path).toContain(t(locale, "landing.hero.title"));
      expect(html, path).not.toContain("Something new");
      expect(html.match(/<h1[\s>]/g), path).toHaveLength(1);
    }
  });

  it("AC1: uses the approved EN and VI copy", async () => {
    const en = textOf(await (await get("/")).text());
    expect(en).toContain("The marketplace for AI-built products and the people who build them.");
    expect(en).toContain("Have an idea? Find a product, customize one, or build your own.");
    expect(en).toContain("Rankings are never for sale.");
    const vi = textOf(await (await get("/vi")).text());
    expect(vi).toContain("Chợ cho sản phẩm xây bằng AI và những người xây chúng.");
    expect(vi).toContain("Thứ hạng không bao giờ được bán.");
  });

  it("AC2: has canonical on APP_ORIGIN, hreflang for 4 locales + x-default, Open Graph and Organization JSON-LD", async () => {
    for (const { path, locale, canonical } of PAGES) {
      // A preview host must never become canonical.
      const html = await (await fetchAt(`https://vnxsi-web.preview.workers.dev${path}`)).text();
      expect(html, path).toContain(`<title>${t(locale, "landing.meta.title")}</title>`);
      expect(html, path).toContain(`<link rel="canonical" href="${canonical}"`);
      for (const [lang, href] of [
        ["en", "https://vnx.si/"],
        ["vi", "https://vnx.si/vi/"],
        ["zh-Hans", "https://vnx.si/zh-hans/"],
        ["zh-Hant", "https://vnx.si/zh-hant/"],
        ["x-default", "https://vnx.si/"],
      ]) {
        expect(html, `${path} ${lang}`).toContain(`<link rel="alternate" hreflang="${lang}" href="${href}"`);
      }
      expect(decode(html), path).toContain(`<meta property="og:title" content="${t(locale, "landing.meta.title")}"`);
      expect(decode(html), path).toContain(`<meta property="og:description" content="${t(locale, "landing.meta.description")}"`);
      expect(decode(html), path).toContain(`<meta name="description" content="${t(locale, "landing.meta.description")}"`);
      expect(jsonLd(html), path).toEqual({ "@context": "https://schema.org", "@type": "Organization", name: "VNX.SI", url: "https://vnx.si/" });
      expect(html, path).not.toContain("preview.workers.dev");
      expect(html, path).not.toContain('name="robots"');
    }
  });

  it("AC3: builder button goes to login with next=hub/apply when signed out", async () => {
    const vi = mainOf(await (await get("/vi")).text());
    expect(vi.match(/href="\/vi\/login\?next=%2Fvi%2Fhub%2Fapply"/g)).toHaveLength(2);
    expect(vi).toContain(t("vi", "landing.cta.builder"));
    const en = mainOf(await (await get("/")).text());
    expect(en.match(/href="\/login\?next=%2Fhub%2Fapply"/g)).toHaveLength(2);
    const zh = mainOf(await (await get("/zh-hant")).text());
    expect(zh.match(/href="\/zh-hant\/login\?next=%2Fzh-hant%2Fhub%2Fapply"/g)).toHaveLength(2);
  });

  it("AC3: builder button goes to the hub when signed in", async () => {
    const { cookie } = await signIn("landing-signed-in@vnx.si");
    const vi = mainOf(await (await get("/vi", cookie)).text());
    expect(vi.match(/href="\/vi\/hub"/g)).toHaveLength(2);
    expect(vi).not.toContain("/login");
    const en = mainOf(await (await get("/", cookie)).text());
    expect(en.match(/href="\/hub"/g)).toHaveLength(2);
  });

  it("AC4: shows no numbers in <main> and no links to /products or /builders", async () => {
    for (const { path } of PAGES) {
      for (const suffix of ["", "?joined=1"]) {
        const main = mainOf(await (await get(path + suffix)).text());
        expect(main, path + suffix).not.toBe("");
        expect(textOf(main), path + suffix).not.toMatch(/\d/);
        expect(main, path + suffix).not.toMatch(/href="[^"]*\/(products|builders)\b/);
      }
    }
  });

  it("links to /request next to the waitlist form without replacing it (Owner 2026-10-04)", async () => {
    const main = mainOf(await (await get("/vi")).text());
    expect(main).toMatch(/<section id="notify"[\s\S]*href="\/vi\/request"[\s\S]*<form method="post" action="\/vi\/waitlist#notify"/);
  });

  it("has the notify section with a labelled, accessible form and a hidden honeypot", async () => {
    const html = await (await get("/vi")).text();
    const main = mainOf(html);
    expect(main).toContain('href="#notify"');
    expect(main).toContain('id="notify"');
    expect(main).toContain('<form method="post" action="/vi/waitlist#notify"');
    expect(main).toMatch(/<label for="waitlist-email">/);
    expect(main).toMatch(/<input id="waitlist-email" name="email" type="email"/);
    expect(main).toMatch(/<input id="waitlist-consent" name="consent" type="checkbox"/);
    expect(main).toMatch(/<label for="waitlist-consent">/);
    expect(textOf(main)).toContain(t("vi", "landing.form.consent"));
    // The honeypot is hidden from people and from screen readers, and out of the tab order.
    expect(main).toMatch(/<div class="hp" aria-hidden="true"><input name="website" type="text" tabindex="-1" autocomplete="off"/);
    expect(main).not.toContain('role="status"');
  });

  it("carries utm_* from the page query into hidden inputs, capped at 200 characters", async () => {
    const long = "x".repeat(250);
    const main = mainOf(await (await get(`/?utm_source=newsletter&utm_medium=email&utm_campaign=${long}`)).text());
    expect(main).toContain('<input type="hidden" name="utm_source" value="newsletter"');
    expect(main).toContain('<input type="hidden" name="utm_medium" value="email"');
    expect(main).toContain(`<input type="hidden" name="utm_campaign" value="${"x".repeat(200)}"`);
    const plain = mainOf(await (await get("/")).text());
    expect(plain).not.toContain('name="utm_source"');
  });

  it("F1: carries an external Referer host into a hidden ref input, never the site's own hosts", async () => {
    const withRef = (path: string, referer: string) =>
      createApp().request(new Request(`https://vnx.si${path}`, { headers: { referer } }), undefined, testEnv);
    const main = mainOf(await (await withRef("/vi", "https://news.ycombinator.com/item?id=1")).text());
    expect(main).toContain('<input type="hidden" name="ref" value="news.ycombinator.com"');
    expect(main).not.toContain("item?id");
    for (const internal of ["https://vnx.si/products", "https://www.vnx.si/x", "not a url"]) {
      const html = mainOf(await (await withRef("/", internal)).text());
      expect(html, internal).not.toContain('name="ref"');
    }
    expect(mainOf(await (await get("/")).text())).not.toContain('name="ref"');
  });

  it("AC11: ?joined=1 shows the success message instead of the form", async () => {
    for (const { path, locale } of PAGES) {
      const main = mainOf(await (await get(`${path}?joined=1`)).text());
      expect(main, path).toContain('role="status"');
      expect(textOf(main), path).toContain(t(locale, "landing.form.joined"));
      expect(main, path).not.toContain("<form");
      expect(main, path).toContain('id="notify"');
    }
    const plain = textOf(mainOf(await (await get("/")).text()));
    expect(plain).not.toContain(t("en", "landing.form.joined"));
  });
});
