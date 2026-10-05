import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { LEGAL, LEGAL_UPDATED_AT } from "../../src/legal/content.ts";
import { LOCALES, localizedPath, type Locale } from "../../src/i18n/locales.ts";
import type { MessageKey } from "../../src/i18n/messages/en.ts";
import { t } from "../../src/i18n/t.ts";
import { InlineText, parseInline } from "../../src/views/LegalPage.tsx";
import { testEnv } from "../helpers.ts";

const PARTNERS_BLOCK = /<div data-partners="active">[\s\S]*?<\/div>/;
const fetchAt = (url: string) => createApp().request(new Request(url), undefined, testEnv);
const get = (path: string) => fetchAt(`https://vnx.si${path}`);

const decode = (s: string) =>
  s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const mainOf = (html: string) => /<main[^>]*>([\s\S]*)<\/main>/.exec(html)?.[1] ?? "";
const textOf = (html: string) => decode(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ");

const PAGES = [
  { rest: "/terms", id: "terms", meta: "legal.terms" },
  { rest: "/privacy", id: "privacy", meta: "legal.privacy" },
  { rest: "/media-kit", id: "mediaKit", meta: "legal.mediaKit" },
  { rest: "/disclosure", id: "disclosure", meta: "legal.disclosure" },
] as const;

const metaKey = (meta: string, part: "title" | "description") => `${meta}.${part}` as MessageKey;

describe("legal pages (VNX-0705a)", () => {
  it("AC1: every page answers 200 in 4 locales with one h1, canonical, hreflang and meta description", async () => {
    for (const { rest, meta } of PAGES) {
      for (const locale of LOCALES) {
        const path = localizedPath(locale, rest);
        // A preview host must never become canonical.
        const res = await fetchAt(`https://vnxsi-web.preview.workers.dev${path}`);
        expect(res.status, path).toBe(200);
        expect(res.headers.get("content-type"), path).toContain("text/html");
        const html = await res.text();
        expect(html, path).toContain(`<html lang="${locale}">`);
        expect(html.match(/<h1[\s>]/g), path).toHaveLength(1);
        expect(decode(html), path).toContain(`<title>${t(locale, metaKey(meta, "title"))} · VNX.SI</title>`);
        expect(html, path).toContain(`<link rel="canonical" href="https://vnx.si${path}"`);
        for (const l of LOCALES) {
          expect(html, `${path} ${l}`).toContain(`<link rel="alternate" hreflang="${l}" href="https://vnx.si${localizedPath(l, rest)}"`);
        }
        expect(html, path).toContain(`<link rel="alternate" hreflang="x-default" href="https://vnx.si${rest}"`);
        expect(decode(html), path).toContain(`<meta name="description" content="${t(locale, metaKey(meta, "description"))}"`);
        expect(html, path).not.toContain('name="robots"');
        expect(html, path).not.toContain("preview.workers.dev");
      }
    }
  });

  it("AC1: EN and VI show their own title; Terms and Privacy show the update date, the Media kit does not", async () => {
    for (const { rest, id } of PAGES) {
      for (const locale of ["en", "vi"] as const) {
        const main = mainOf(await (await get(localizedPath(locale, rest))).text());
        expect(main, rest).toMatch(new RegExp(`<h1[^>]*>${LEGAL[id][locale].title}</h1>`));
        const dated = textOf(main).includes(t(locale, "legal.updated", { date: LEGAL_UPDATED_AT }));
        expect(dated, `${locale} ${rest}`).toBe(id !== "mediaKit");
      }
    }
  });

  it("AC3: zh-Hans and zh-Hant say the page is English only and wrap the English text in lang=en", async () => {
    for (const locale of ["zh-Hans", "zh-Hant"] as const) {
      for (const { rest, id } of PAGES) {
        const path = localizedPath(locale, rest);
        const main = mainOf(await (await get(path)).text());
        const notice = t(locale, "legal.englishOnly");
        expect(textOf(main), path).toContain(notice);
        // The notice comes before the English text.
        const block = /<div lang="en"[^>]*>([\s\S]*)<\/div>/.exec(main);
        expect(block, path).not.toBeNull();
        expect(textOf(main).indexOf(notice), path).toBeLessThan(textOf(main).indexOf(LEGAL[id].en.title));
        expect(block?.[1], path).toContain(`>${LEGAL[id].en.title}</h1>`);
        expect(textOf(block?.[1] ?? ""), path).toContain(LEGAL[id].en.sections[0]?.heading ?? "missing");
        expect(textOf(main), path).not.toContain(LEGAL[id].vi.sections[0]?.heading ?? "missing");
      }
    }
    // The other zh notice never leaks, and the date line is in the page's own language.
    const hans = textOf(mainOf(await (await get("/zh-hans/privacy")).text()));
    expect(hans).not.toContain(t("zh-Hant", "legal.englishOnly"));
    expect(hans).toContain(t("zh-Hans", "legal.updated", { date: LEGAL_UPDATED_AT }));
  });

  it("AC3: EN and VI pages carry no English-only notice", async () => {
    for (const locale of ["en", "vi"] as const) {
      for (const { rest } of PAGES) {
        const main = mainOf(await (await get(localizedPath(locale, rest))).text());
        for (const l of LOCALES) expect(textOf(main), `${locale} ${rest}`).not.toContain(t(l, "legal.englishOnly"));
      }
    }
  });

  it("AC3: the zh englishOnly sentences are the approved ones", () => {
    expect(t("zh-Hans", "legal.englishOnly")).toBe("本页面目前仅提供英文版本，以英文版本为准。");
    expect(t("zh-Hant", "legal.englishOnly")).toBe("本頁面目前僅提供英文版本，以英文版本為準。");
    expect(t("en", "legal.englishOnly")).toBe("This page is available in English only.");
  });

  it("AC4: renders `code`, **bold** and contact@vnx.si as code, strong and a mailto link", async () => {
    for (const locale of LOCALES) {
      const main = mainOf(await (await get(localizedPath(locale, "/privacy"))).text());
      expect(main, locale).toContain("<code>__Host-vnx_session</code>");
      expect(main, locale).toContain("<code>utm_*</code>");
      expect(main, locale).toContain("<strong>Cloudflare</strong>");
      expect(main, locale).toContain('<a href="mailto:contact@vnx.si">contact@vnx.si</a>');
      expect(textOf(main), locale).not.toContain("**");
      expect(textOf(main), locale).not.toContain("`");
    }
  });

  it("AC4: content brings no tags of its own", async () => {
    const allowed = new Set(["article", "div", "p", "h1", "h2", "ul", "li", "code", "strong", "a", "span"]);
    for (const { rest } of PAGES) {
      for (const locale of LOCALES) {
        // The partner list is data from D1, shared between test files: check it on its own below.
        const main = mainOf(await (await get(localizedPath(locale, rest))).text()).replace(PARTNERS_BLOCK, "");
        const tags = new Set([...main.matchAll(/<\/?([a-z0-9]+)/g)].map((m) => m[1] ?? ""));
        for (const tag of tags) expect(allowed.has(tag), `${locale} ${rest} <${tag}>`).toBe(true);
        for (const href of main.matchAll(/href="([^"]*)"/g)) expect(href[1], `${locale} ${rest}`).toBe("mailto:contact@vnx.si");
      }
    }
    // The source text itself holds no markup.
    for (const page of Object.values(LEGAL)) {
      for (const doc of [page.en, page.vi]) expect(JSON.stringify(doc)).not.toMatch(/[<>]/);
    }
  });

  it("AC4: the partner list on /disclosure links only to localized /tools/<slug>", async () => {
    for (const locale of LOCALES) {
      const block = PARTNERS_BLOCK.exec(mainOf(await (await get(localizedPath(locale, "/disclosure"))).text()))?.[0] ?? "";
      expect(block, locale).not.toBe("");
      const re = new RegExp(`^${localizedPath(locale, "/tools")}/[a-z0-9-]+$`);
      for (const href of block.matchAll(/href="([^"]*)"/g)) expect(href[1], locale).toMatch(re);
    }
  });

  it("AC4: parseInline splits only code, strong and the contact e-mail", () => {
    expect(parseInline("Use `__Host-x` and **Cloudflare**, or email contact@vnx.si.")).toEqual([
      { kind: "text", text: "Use " },
      { kind: "code", text: "__Host-x" },
      { kind: "text", text: " and " },
      { kind: "strong", text: "Cloudflare" },
      { kind: "text", text: ", or email " },
      { kind: "email", text: "contact@vnx.si" },
      { kind: "text", text: "." },
    ]);
    expect(parseInline("plain *one* star, other@vnx.si, [link](https://x.y)")).toEqual([
      { kind: "text", text: "plain *one* star, other@vnx.si, [link](https://x.y)" },
    ]);
    expect(parseInline("")).toEqual([]);
  });

  it("AC4: InlineText escapes everything that is not one of the three marks", () => {
    const html = String(InlineText({ text: '<b onclick="x">hi</b> **<i>** `<script>`' }));
    expect(html).toContain("&lt;b onclick=&quot;x&quot;&gt;hi&lt;/b&gt;");
    expect(html).toContain("<strong>&lt;i&gt;</strong>");
    expect(html).toContain("<code>&lt;script&gt;</code>");
    expect(html).not.toContain("<b ");
    expect(html).not.toContain("<script>");
  });

  it("AC5: the Media kit shows no number except the colour codes, and no partner name", async () => {
    const partners = /partnerstack|lovable|bolt|replit|cursor|vercel|supabase|hostinger|windsurf|v0\b/i;
    for (const locale of LOCALES) {
      const main = mainOf(await (await get(localizedPath(locale, "/media-kit"))).text());
      const text = textOf(main);
      expect(text, locale).toContain("#0D1526");
      expect(text.replace(/#[0-9A-F]{6}\b/g, ""), locale).not.toMatch(/\d/);
      expect(text, locale).not.toMatch(partners);
    }
  });

  it("Media kit: shows a colour swatch next to each of the three brand colours", async () => {
    const main = mainOf(await (await get("/media-kit")).text());
    for (const hex of ["#0D1526", "#1D4ED8", "#F4F5F7"]) {
      expect(main, hex).toMatch(new RegExp(`<span class="swatch" style="background-color:${hex}" aria-hidden="true"></span><code>${hex}</code>`));
    }
    expect(main.match(/class="swatch"/g)).toHaveLength(3);
  });
});
