import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { LOCALES, localizedPath, type Locale } from "../../src/i18n/locales.ts";
import { t } from "../../src/i18n/t.ts";
import { signIn } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

// VNX-0706 (Owner A2: no cutover): skip link, .error-msg contrast in dark mode, 44 px targets.
const get = (path: string, cookie?: string) =>
  createApp().request(new Request(`https://vnx.si${path}`, { headers: cookie ? { cookie } : {} }), undefined, testEnv);
// import.meta.glob "?raw" yields an empty string for .css in workerd, so read app.css the way assets.test.ts does: through the app.
const CSS_RES = await get("/assets/app.css");
if (CSS_RES.status !== 200) throw new Error(`app.css fetch status ${CSS_RES.status}`);
const CSS = await CSS_RES.text();

/** WCAG 2.x relative luminance and contrast ratio of two #rrggbb colours. */
const channel = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const luminance = (hex: string) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255); };
const contrast = (a: string, b: string) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi! + 0.05) / (lo! + 0.05); };

/** Hex tokens of the first rule block whose header matches. */
function tokens(header: RegExp): Record<string, string> {
  const m = header.exec(CSS);
  if (!m) throw new Error(`no CSS block for ${header}`);
  const start = m.index + m[0].length;
  const body = CSS.slice(start, CSS.indexOf("}", start));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)].map((x) => [x[1]!, x[2]!]));
}
const THEMES = {
  light: tokens(/^:root \{/m),
  "dark (prefers-color-scheme)": tokens(/:root:not\(\[data-theme="light"\]\) \{/),
  "dark (data-theme)": tokens(/:root\[data-theme="dark"\] \{/),
};

describe("contrast helper", () => {
  it("matches the WCAG reference values", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#767676", "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#777777", "#ffffff")).toBeLessThan(4.5);
  });
});

describe(".error-msg contrast (VNX-0706)", () => {
  it("uses the --error token", () => {
    expect(CSS).toMatch(/\.error-msg\s*\{[^}]*\bcolor:\s*var\(--error\)/);
  });
  for (const [name, tk] of Object.entries(THEMES)) {
    it(`${name}: --error is at least 4.5:1 on --bg, --surface and --surface-2`, () => {
      for (const bg of ["bg", "surface", "surface-2"]) {
        expect(tk[bg], `${name} --${bg}`).toBeDefined();
        expect(contrast(tk.error!, tk[bg]!), `${name} error on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    });
    it(`${name}: the skip link (--on-primary on --primary) is at least 4.5:1`, () => {
      expect(contrast(tk["on-primary"]!, tk.primary!)).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe("hit areas (VNX-0706)", () => {
  const rules = [...CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selectors: m[1]!.split(",").map((s) => s.trim()), body: m[2]! }));
  const px = (body: string, prop: string) => [...body.matchAll(new RegExp(`(?:^|[;\\s])${prop}:\\s*(\\d+)px`, "g"))].map((m) => Number(m[1]));
  for (const selector of [".brand", ".nav-account", ".site-nav a", ".site-footer .footer-nav a"]) {
    it(`${selector} declares min-height and min-width of at least 44px and never less`, () => {
      const own = rules.filter((r) => r.selectors.includes(selector));
      expect(own.length, selector).toBeGreaterThan(0);
      for (const prop of ["min-height", "min-width"]) {
        const values = own.flatMap((r) => px(r.body, prop));
        expect(values.length, `${selector} ${prop}`).toBeGreaterThan(0);
        expect(Math.min(...values), `${selector} ${prop}`).toBeGreaterThanOrEqual(44);
      }
    });
  }

  it("renders the brand and the sign-in link in the header of every locale", async () => {
    for (const locale of LOCALES) {
      const html = await (await get(localizedPath(locale, "/products"))).text();
      const header = /<header class="site-header">([\s\S]*?)<\/header>/.exec(html)![1]!;
      expect(header, locale).toContain('class="brand"');
      expect(header, locale).toContain(`class="nav-account" href="${localizedPath(locale, "/login")}"`);
    }
  });
});

describe("skip link (VNX-0706)", () => {
  const PAGES = ["/", "/vi/products", "/zh-hans/builders", "/zh-hant/terms", "/login", "/vi/no-such-page"];
  const localeOf = (path: string): Locale => (path.startsWith("/vi") ? "vi" : path.startsWith("/zh-hans") ? "zh-Hans" : path.startsWith("/zh-hant") ? "zh-Hant" : "en");

  it("is the first element of <body> and points at #main, in every locale", async () => {
    for (const path of PAGES) {
      const html = await (await get(path)).text();
      const m = /<body>\s*<a class="skip-link" href="#main">([^<]*)<\/a>\s*<header class="site-header">/.exec(html);
      expect(m, path).not.toBeNull();
      expect(m![1], path).toBe(t(localeOf(path), "a11y.skipToContent"));
    }
  });

  it("has its target: exactly one id=\"main\", and the skip link comes before every other link", async () => {
    for (const path of PAGES) {
      const html = await (await get(path)).text();
      expect(html.match(/\bid="main"/g), path).toHaveLength(1);
      const body = html.slice(html.indexOf("<body>"));
      expect(body.indexOf("<a "), path).toBe(body.indexOf('<a class="skip-link"'));
    }
  });

  it("also leads when signed in", async () => {
    const { cookie } = await signIn("a11y-skip@vnx.si");
    expect(await (await get("/me", cookie)).text()).toMatch(/<body>\s*<a class="skip-link" href="#main">/);
  });

  it("is hidden off-screen until focused, without display:none", () => {
    const rule = /\.skip-link\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? "";
    expect(rule).toMatch(/position:\s*absolute/);
    expect(rule).toMatch(/top:\s*-\d+px/);
    expect(rule).not.toMatch(/display:\s*none|visibility:\s*hidden/);
    expect(CSS).toMatch(/\.skip-link:focus\s*\{[^}]*top:\s*\d+px/);
  });
});
