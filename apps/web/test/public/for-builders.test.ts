import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { LOCALES, localizedPath, type Locale } from "../../src/i18n/locales.ts";
import type { MessageKey } from "../../src/i18n/messages/en.ts";
import { t } from "../../src/i18n/t.ts";
import { builderCtaHref } from "../../src/views/Layout.tsx";
import type { Bindings } from "../../src/env.ts";
import { signIn } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

// VNX-0705b (Owner D2): the page is built only from the approved landing copy.
const get = (path: string, cookie?: string) =>
  createApp().request(new Request(`https://vnx.si${path}`, { headers: cookie ? { cookie } : {} }), undefined, testEnv);
const decode = (s: string) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const norm = (s: string) => decode(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
const mainOf = (html: string) => /<main[^>]*>([\s\S]*)<\/main>/.exec(html)?.[1] ?? "";
const PATH = (l: Locale) => localizedPath(l, "/for-builders");

/** Exactly these keys, in this order. Nothing else may appear in <main>. */
const APPROVED: MessageKey[] = [
  "landing.builders.eyebrow", "landing.builders.title", "landing.builders.sub",
  "landing.builders.perk.free", "landing.builders.perk.tools", "landing.builders.perk.requests",
  "landing.builders.apply",
  "landing.builders.step.apply.title", "landing.builders.step.apply.body",
  "landing.builders.step.list.title", "landing.builders.step.list.body",
  "landing.builders.step.requests.title", "landing.builders.step.requests.body",
];

describe("/for-builders (VNX-0705b)", () => {
  for (const locale of LOCALES) {
    it(`${locale}: 200, canonical, hreflang, one h1, no script`, async () => {
      const res = await get(PATH(locale));
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain(`<html lang="${locale}">`);
      expect(html).toContain(`<link rel="canonical" href="https://vnx.si${PATH(locale)}"`);
      for (const [hreflang, href] of [["en", "/for-builders"], ["vi", "/vi/for-builders"], ["zh-Hans", "/zh-hans/for-builders"], ["zh-Hant", "/zh-hant/for-builders"], ["x-default", "/for-builders"]]) {
        expect(html, hreflang).toContain(`<link rel="alternate" hreflang="${hreflang}" href="https://vnx.si${href}"`);
      }
      expect(html.match(/<h1[ >]/g)).toHaveLength(1);
      expect(norm(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)![1]!)).toBe(t(locale, "landing.builders.title"));
      expect(html).toContain(`<title>${t(locale, "nav.forBuilders")} · VNX.SI</title>`);
      expect(html).not.toContain("<script");
    });

    it(`${locale}: <main> is exactly the approved landing copy, nothing invented`, async () => {
      const main = mainOf(await (await get(PATH(locale))).text());
      expect(norm(main)).toBe(norm(APPROVED.map((k) => t(locale, k)).join(" ")));
      expect(norm(main)).not.toMatch(/\d/);
      expect(main).not.toMatch(/<img|<script|<form|<input/);
    });
  }

  it("the only link in <main> is the builder CTA, same target as the landing page", async () => {
    for (const locale of LOCALES) {
      const main = mainOf(await (await get(PATH(locale))).text());
      const links = [...main.matchAll(/<a\s[^>]*href="([^"]*)"[^>]*>/g)].map((m) => decode(m[1]!));
      expect(links, locale).toEqual([builderCtaHref(locale, false)]);
    }
    const { cookie } = await signIn("for-builders-in@vnx.si");
    const env = { ...testEnv, PRIVACY_NOTICE_GO_LIVE: "" } as Bindings; // a production go-live date would add a /vi/privacy notice link to <main>
    const res = await createApp().request(new Request("https://vnx.si/vi/for-builders", { headers: { cookie } }), undefined, env);
    const main = mainOf(await res.text());
    expect([...main.matchAll(/<a\s[^>]*href="([^"]*)"/g)].map((m) => m[1])).toEqual(["/vi/hub"]);
  });

  it("is in the header nav (replacing /#builders), marked current on its own page", async () => {
    for (const locale of LOCALES) {
      const html = await (await get(PATH(locale))).text();
      const header = /<header class="site-header">([\s\S]*?)<\/header>/.exec(html)![1]!;
      expect(header).toContain(`href="${PATH(locale)}" aria-current="page"`);
      expect(header).not.toMatch(/href="[^"]*#builders"/);
    }
    const other = await (await get("/products")).text();
    expect(other).toContain('<a href="/for-builders">');
  });
});
