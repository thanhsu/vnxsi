import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { LOCALES, localizedPath } from "../../src/i18n/locales.ts";
import { t } from "../../src/i18n/t.ts";
import { formatCount } from "../../src/views/format.ts";
import { testEnv } from "../helpers.ts";
import { block, getHome, seedSnapshot } from "./blocks.ts";

const get = (path: string) => createApp().request(new Request(`https://vnx.si${path}`), undefined, testEnv);
const text = async (path: string) => (await get(path)).text();
const atBlocks = (css: string, rule: string) => {
  const out: { prelude: string; body: string }[] = [];
  const re = new RegExp(`@${rule}\\b([^{]*)\\{`, "g");
  for (let m = re.exec(css); m; m = re.exec(css)) {
    let depth = 1;
    let i = re.lastIndex;
    for (; i < css.length && depth > 0; i++) depth += css[i] === "{" ? 1 : css[i] === "}" ? -1 : 0;
    out.push({ prelude: (m[1] ?? "").trim(), body: css.slice(re.lastIndex, i - 1) });
  }
  return out;
};

describe("home.js (VNX-0704b)", () => {
  it("is at most 6 KB, same-origin, no network, no import, no innerHTML, no timer that rotates cards", async () => {
    const res = await get("/assets/home.js");
    expect(res.status).toBe(200);
    expect((await res.arrayBuffer()).byteLength).toBeLessThanOrEqual(6 * 1024);
    const js = await text("/assets/home.js");
    expect(js).not.toMatch(/\bimport\b|\brequire\(|\bfetch\(|XMLHttpRequest|sendBeacon|https?:\/\/|document\.cookie|localStorage|innerHTML|\beval\(|new Function/);
    expect(js).not.toContain("setInterval");
    expect(js).toMatch(/matchMedia\(\s*["']\(prefers-reduced-motion: reduce\)["']\s*\)/);
  });
  it("selects only by data-* hooks, never by where a block sits", async () => {
    const js = await text("/assets/home.js");
    for (const hook of ["[data-count]", "[data-marquee]", "[data-motion-toggle]", "[data-tip]"]) expect(js).toContain(hook);
    expect(js).not.toMatch(/["'][^"']*(#home-|\.lp-|\.home-block|\bsection\b|\.container)[^"']*["']/);
  });
  it("is loaded with defer on / in every locale, once, and on no other page", async () => {
    for (const path of ["/", "/vi/", "/zh-hans/", "/zh-hant/"]) {
      const html = await text(path);
      expect(html.match(/<script[^>]*src="\/assets\/home\.js"[^>]*>/g), path).toEqual([expect.stringMatching(/\sdefer(=|>|\s)/)]);
      expect(html, path).toContain("/assets/landing.js");
    }
    for (const path of ["/products", "/builders", "/vi/terms", "/login", "/for-builders"]) expect(await text(path), path).not.toContain("home.js");
  });
  it("keeps the JS of / under 60 KB in total", async () => {
    const srcs = [...(await text("/")).matchAll(/<script[^>]*\ssrc="(\/[^"]+)"/g)].map((m) => m[1]!);
    expect(srcs).toContain("/assets/home.js");
    let total = 0;
    for (const src of srcs) total += (await (await get(src)).arrayBuffer()).byteLength;
    expect(total).toBeLessThanOrEqual(60 * 1024);
  });
});

describe("markup hooks", () => {
  it("every Numbers tile prints its final value (visually hidden for screen readers) and animates an aria-hidden copy carrying data-count", async () => {
    await seedSnapshot();
    const tiles = [...block(await getHome(), "home-numbers").matchAll(/<strong><span class="visually-hidden">([^<]*)<\/span><span aria-hidden="true" data-count="(\d+)">([^<]*)<\/span><\/strong>/g)];
    expect(tiles.length).toBeGreaterThanOrEqual(2);
    for (const [, real, value, shown] of tiles) {
      expect(shown).toBe(formatCount("en", Number(value)));
      expect(real, "the real value is what a screen reader gets").toBe(shown);
    }
  });
  it("Live keeps the static list, marks it for the strip, and holds a hidden pause button in every locale", async () => {
    await seedSnapshot();
    for (const locale of LOCALES) {
      const html = block(await getHome(localizedPath(locale, "/")), "home-live");
      expect(html, locale).toMatch(/<ul[^>]*data-marquee/);
      expect(html, locale).toMatch(/<button[^>]*type="button"[^>]*data-motion-toggle[^>]*>/);
      expect(html, locale).toMatch(/<button[^>]*\shidden/);
      expect(html, locale).toContain('aria-pressed="false"');
      expect(html, locale).toContain(t(locale, "home.motion.pause"));
      expect(html, locale).not.toMatch(/\sstyle=|\son[a-z]+=/i);
    }
  });
  it("section heads reveal on scroll and tiles lift, using the classes the reduced-motion block already covers", async () => {
    await seedSnapshot();
    const html = await getHome();
    for (const id of ["home-numbers", "home-trending", "home-pulse"]) expect(block(html, id), id).toContain('class="section-head reveal-scroll"');
    expect(block(html, "home-trending")).toMatch(/<li class="home-tile lift"/);
    expect(block(html, "home-products")).toMatch(/<li class="home-tile lift"/);
  });
  it("chart groups carry data-tip text with the label and every series value", async () => {
    await seedSnapshot();
    const tips = [...block(await getHome(), "home-pulse").matchAll(/data-tip="([^"]+)"/g)].map((m) => m[1]!);
    expect(tips.length).toBeGreaterThan(0);
    for (const tipText of tips) expect(tipText).toMatch(/: .+ \d+ · .+ \d+/);
  });
});

describe("CSS motion (spec §9: reduced motion has no animation)", () => {
  it("runs chart and sparkline animation only inside the one @supports (animation-timeline: view()) block", async () => {
    const css = await text("/assets/app.css");
    const supports = atBlocks(css, "supports").filter((b) => /animation-timeline:\s*view\(\)/.test(b.prelude));
    expect(supports).toHaveLength(1);
    for (const selector of [".chart-bar", ".chart-line", ".home-spark polyline"]) expect(supports[0]!.body, selector).toContain(selector);
    expect(supports[0]!.body).toMatch(/\.chart\s*\{[^}]*view-timeline:\s*--chart-in/);
    expect(supports[0]!.body).toMatch(/\.home-spark\s*\{[^}]*view-timeline:\s*--spark-in/);
    expect(supports[0]!.body).toMatch(/\.chart-bar[^{]*\{[^}]*animation-timeline:\s*--chart-in/);
    expect(supports[0]!.body).toMatch(/\.home-spark polyline[^{]*\{[^}]*animation-timeline:\s*--spark-in/);
    // Outside @supports (and outside the reduced-motion blocks, whose `animation: none` is the point) nothing animates a chart.
    let plain = css.replace(supports[0]!.body, "");
    for (const m of atBlocks(css, "media").filter((x) => /prefers-reduced-motion/.test(x.prelude))) plain = plain.replace(m.body, "");
    expect(plain).not.toMatch(/\.chart-(bar|line)[^{]*\{[^}]*animation\s*:/);
  });
  it("turns off every home animation under prefers-reduced-motion: reduce", async () => {
    const css = await text("/assets/app.css");
    const reduce = atBlocks(css, "media").filter((b) => /prefers-reduced-motion:\s*reduce/.test(b.prelude)).map((b) => b.body).join("\n");
    for (const selector of [".chart-bar", ".chart-line", ".home-spark polyline", ".home-marquee-track"]) expect(reduce, selector).toContain(selector);
    expect(reduce).toMatch(/animation:\s*none\s*!important/);
    expect(reduce).toMatch(/stroke-dasharray:\s*none/);
    // The strip stands still like the landing belt: wrapped, copy hidden.
    expect(reduce).toMatch(/\.home-marquee \.home-live\s*\{[^}]*flex-wrap:\s*wrap/);
    expect(reduce).toMatch(/\.home-marquee-track\s*\{[^}]*width:\s*auto/);
    expect(reduce).toMatch(/\.home-marquee-track > \[aria-hidden="true"\]\s*\{[^}]*display:\s*none/);
  });
  it("pauses the strip on hover and the toggle, stops it on focus, and the tooltip ignores the pointer", async () => {
    const css = await text("/assets/app.css");
    expect(css).toMatch(/\.home-marquee:hover[^{]*\{[^}]*animation-play-state:\s*paused/);
    // Focus stops the strip dead (animation: none), so the browser can scroll the focused link into view.
    expect(css).toMatch(/\.home-marquee:focus-within \.home-marquee-track\s*\{[^}]*animation:\s*none/);
    expect(css).toMatch(/\.home-marquee\.is-paused[^{]*\{[^}]*animation-play-state:\s*paused/);
    expect(css).toMatch(/\.chart-tip\s*\{[^}]*pointer-events:\s*none/);
  });
  it("reveals the crosshair for the active group, so touch (no :hover) gets it too, and the chevron transition is off under reduce", async () => {
    const css = await text("/assets/app.css");
    expect(css).toMatch(/\.chart-group\.is-active \.chart-cross[^{]*\{[^}]*stroke:\s*var\(--text-2\)/);
    const reduce = atBlocks(css, "media").filter((b) => /prefers-reduced-motion:\s*reduce/.test(b.prelude)).map((b) => b.body).join("\n");
    expect(reduce).toMatch(/\.chart-data summary::after\s*\{[^}]*transition:\s*none/);
  });
  it("never hides a chart or number in a plain rule (no opacity 0, hidden or scale(0))", async () => {
    const css = await text("/assets/app.css");
    for (const m of css.matchAll(/([^{}]*\.(?:chart-bar|chart-line|home-numbers)[^{}]*)\{([^}]*)\}/g)) expect(m[2], m[1]).not.toMatch(/opacity\s*:\s*0\b|visibility\s*:\s*hidden|scale\(0/);
  });
});
