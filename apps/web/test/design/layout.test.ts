import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { LOCALE_LABEL, LOCALES, localizedPath, type Locale } from "../../src/i18n/locales.ts";
import { t } from "../../src/i18n/t.ts";
import { signIn } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

// VNX-0709: logo, header and footer on every page.
const get = (path: string, cookie?: string) =>
  createApp().request(new Request(`https://vnx.si${path}`, { headers: cookie ? { cookie } : {} }), undefined, testEnv);
const html = async (path: string, cookie?: string) => (await get(path, cookie)).text();

const decode = (s: string) =>
  s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const textOf = (s: string) => decode(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
const headerOf = (s: string) => /<header class="site-header">([\s\S]*?)<\/header>/.exec(s)?.[1] ?? "";
const footerOf = (s: string) => /<footer class="site-footer">([\s\S]*?)<\/footer>/.exec(s)?.[1] ?? "";
/** Inner HTML of the first element opened by `open` (a regex source for its start tag), tags of the same name matched. */
function inner(s: string, tag: string, attrs: string): string {
  const start = new RegExp(`<${tag}${attrs}[^>]*>`).exec(s);
  if (!start) return "";
  let depth = 1;
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "g");
  re.lastIndex = start.index + start[0].length;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return s.slice(start.index + start[0].length, m.index);
  }
  return "";
}
const hrefs = (s: string) => [...s.matchAll(/<a\s[^>]*?href="([^"]*)"/g)].map((m) => decode(m[1]!));

const NAV = [
  ["/products", "nav.products"],
  ["/builders", "nav.findBuilders"],
  ["/#how", "nav.howItWorks"],
  ["/#builders", "nav.forBuilders"],
] as const;
const navHref = (locale: Locale, target: string) => {
  const [path, hash] = target.split("#");
  return localizedPath(locale, path!) + (hash ? `#${hash}` : "");
};
const ctaHref = (locale: Locale) => `${localizedPath(locale, "/login")}?next=${encodeURIComponent(localizedPath(locale, "/hub/apply"))}`;

describe("logo files (VNX-0709 AC3)", () => {
  it("serves the light mark, the dark mark and the app icon, drawn as Option B", async () => {
    const files = {
      "vnxsi-mark.svg": ["#0D1526", "#FFFFFF", "#1D4ED8"],
      "vnxsi-mark-dark.svg": ["#E8EDF5", "#0A0F1C", "#6B93FF"],
      "vnxsi-icon.svg": ["#0D1526", "#FFFFFF", "#6B93FF"],
    };
    for (const [file, colours] of Object.entries(files)) {
      const res = await get(`/assets/brand/${file}`);
      expect(res.status, file).toBe(200);
      const svg = await res.text();
      expect(svg, file).toMatch(/^<svg[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"[^>]*viewBox="0 0 64 64"/);
      expect(svg, file).toContain('d="M14 16 L32 48 L50 16"');
      expect(svg.match(/<circle /g), file).toHaveLength(3);
      for (const colour of colours) expect(svg.toUpperCase(), `${file} ${colour}`).toContain(colour);
    }
    expect(await (await get("/assets/brand/vnxsi-icon.svg")).text()).toMatch(/<rect [^>]*rx="15"[^>]*fill="#0D1526"/);
  });

  it("links the SVG favicon and shows the mark in the header and footer of every page", async () => {
    for (const path of ["/", "/vi/products", "/zh-hans/builders", "/zh-hant/terms", "/login", "/vi/no-such-page"]) {
      const page = await html(path);
      expect(page, path).toContain('<link rel="icon" type="image/svg+xml" href="/assets/brand/vnxsi-icon.svg"');
      for (const [part, of] of [
        ["header", headerOf],
        ["footer", footerOf],
      ] as const) {
        const brand = inner(of(page), "a", ' class="brand"');
        expect(brand, `${path} ${part}`).toContain('class="brand-mark"');
        expect(brand, `${path} ${part}`).toMatch(/<svg[^>]*viewBox="0 0 64 64"/);
        expect(textOf(brand).replace(/\s/g, ""), `${path} ${part}`).toBe("VNX.SI");
      }
    }
  });
});

describe("header (VNX-0709 AC4)", () => {
  for (const locale of LOCALES) {
    it(`${locale}: main nav, language menu, sign in and the builder CTA, on desktop and in the mobile panel`, async () => {
      const rest = "/products";
      const header = headerOf(await html(localizedPath(locale, rest)));
      expect(inner(header, "a", ' class="brand"')).not.toBe("");
      expect(header).toContain(`<a class="brand" href="${localizedPath(locale, "/")}"`);

      const desktop = inner(header, "nav", ' class="site-nav"');
      expect(hrefs(desktop)).toEqual(NAV.map(([target]) => navHref(locale, target)));
      expect(textOf(desktop)).toBe(NAV.map(([, key]) => t(locale, key)).join(" "));
      // The page being viewed is marked; the others are not.
      expect(desktop).toMatch(new RegExp(`href="${localizedPath(locale, "/products")}" aria-current="page"`));
      expect(desktop.match(/aria-current/g)).toHaveLength(1);

      const lang = inner(header, "details", ' class="lang-menu"');
      expect(lang).toMatch(/<summary[^>]*>/);
      expect(textOf(inner(lang, "summary", ""))).toContain(LOCALE_LABEL[locale]);
      expect(hrefs(lang)).toEqual(LOCALES.map((l) => localizedPath(l, rest)));
      expect(lang).toContain(`hreflang="${locale}"`);
      expect(lang.match(/aria-current="true"/g)).toHaveLength(1);

      const menu = inner(header, "details", ' class="menu"');
      expect(menu).toContain(`<summary aria-label="${t(locale, "nav.menu")}"`);
      const panel = hrefs(menu);
      for (const [target] of NAV) expect(panel, target).toContain(navHref(locale, target));
      for (const l of LOCALES) expect(panel, l).toContain(localizedPath(l, rest));

      for (const part of [header.replace(menu, ""), menu]) {
        expect(part).toMatch(new RegExp(`<a[^>]*href="${localizedPath(locale, "/login")}"[^>]*>${t(locale, "nav.signIn")}</a>`));
        const cta = new RegExp(`<a[^>]*href="${ctaHref(locale).replace(/[?]/g, "\\?")}"[^>]*>\\s*${t(locale, "nav.becomeBuilder")}`);
        expect(part).toMatch(cta);
        expect(part).not.toContain('action="/logout"');
      }
    });
  }

  it("signed in: Builder Hub and a sign-out form instead of Sign in and the CTA", async () => {
    const { cookie } = await signIn("layout-header@vnx.si");
    for (const locale of LOCALES) {
      const header = headerOf(await html(localizedPath(locale, "/products"), cookie));
      const menu = inner(header, "details", ' class="menu"');
      for (const part of [header.replace(menu, ""), menu]) {
        expect(part).toMatch(new RegExp(`<a[^>]*href="${localizedPath(locale, "/hub")}"[^>]*>${t(locale, "nav.hub")}</a>`));
        expect(part).toMatch(/<form method="post" action="\/logout"[^>]*>/);
        expect(textOf(part)).toContain(t(locale, "nav.signOut"));
        expect(part).not.toContain("/login");
      }
    }
  });

  it("keeps the language links on the same page, including on the landing page", async () => {
    const header = headerOf(await html("/zh-hant/"));
    expect(hrefs(inner(header, "details", ' class="lang-menu"'))).toEqual(["/", "/vi/", "/zh-hans/", "/zh-hant/"]);
    const product = headerOf(await html("/vi/terms"));
    expect(hrefs(inner(product, "details", ' class="lang-menu"'))).toEqual(["/terms", "/vi/terms", "/zh-hans/terms", "/zh-hant/terms"]);
  });
});

describe("footer (VNX-0709 AC5)", () => {
  for (const locale of LOCALES) {
    it(`${locale}: four labelled groups, legal links, contact, copyright and languages`, async () => {
      const footer = footerOf(await html(localizedPath(locale, "/builders")));
      const labels = [...footer.matchAll(/<nav[^>]*aria-label="([^"]*)"/g)].map((m) => decode(m[1]!));
      expect(labels).toEqual([t(locale, "footer.marketplace"), t(locale, "footer.builders"), t(locale, "footer.company"), t(locale, "nav.language")]);

      expect(hrefs(inner(footer, "nav", ` aria-label="${t(locale, "footer.marketplace")}"`))).toEqual(
        ["/products", "/builders", "/#how"].map((target) => navHref(locale, target)),
      );
      expect(hrefs(inner(footer, "nav", ` aria-label="${t(locale, "footer.builders")}"`))).toEqual([ctaHref(locale), localizedPath(locale, "/login")]);
      expect(hrefs(inner(footer, "nav", ` aria-label="${t(locale, "footer.company")}"`))).toEqual([
        localizedPath(locale, "/media-kit"),
        "mailto:contact@vnx.si",
        localizedPath(locale, "/terms"),
        localizedPath(locale, "/privacy"),
      ]);
      const langs = inner(footer, "nav", ` aria-label="${t(locale, "nav.language")}"`);
      expect(hrefs(langs)).toEqual(LOCALES.map((l) => localizedPath(l, "/builders")));
      expect(textOf(langs)).toBe(LOCALES.map((l) => LOCALE_LABEL[l]).join(" "));

      const text = textOf(footer);
      expect(text).toContain(`© ${new Date().getUTCFullYear()} VNX.SI`);
      expect(text).toContain(t(locale, "site.tagline"));
      expect(text).toContain(t(locale, "site.rankings"));
      expect(text).toContain("contact@vnx.si");
    });
  }

  it("signed in: the builders group links to the hub", async () => {
    const { cookie } = await signIn("layout-footer@vnx.si");
    const footer = footerOf(await html("/vi/products", cookie));
    expect(hrefs(inner(footer, "nav", ` aria-label="${t("vi", "footer.builders")}"`))).toEqual(["/vi/hub"]);
  });
});
