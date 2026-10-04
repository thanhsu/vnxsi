import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { testEnv } from "../helpers.ts";

// VNX-0709: self-hosted fonts, no third-party requests, motion rules and the landing script.
const FONT_FILES = Object.keys(import.meta.glob("../../public/assets/fonts/*.woff2")).map((p) => p.split("/").pop()!);
const LICENCES = import.meta.glob("../../public/assets/fonts/*.txt", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

const get = (path: string) => createApp().request(new Request(`https://vnx.si${path}`), undefined, testEnv);
const text = async (path: string) => {
  const res = await get(path);
  expect(res.status, path).toBe(200);
  return res.text();
};
const headOf = (html: string) => /<head>([\s\S]*)<\/head>/.exec(html)?.[1] ?? "";

/** The body of every `@<rule> <prelude> { … }` block, braces matched. */
function atBlocks(css: string, rule: string): { prelude: string; body: string }[] {
  const out: { prelude: string; body: string }[] = [];
  const re = new RegExp(`@${rule}\\b([^{]*)\\{`, "g");
  for (let m = re.exec(css); m; m = re.exec(css)) {
    let depth = 1;
    let i = re.lastIndex;
    for (; i < css.length && depth > 0; i++) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") depth--;
    }
    out.push({ prelude: (m[1] ?? "").trim(), body: css.slice(re.lastIndex, i - 1) });
  }
  return out;
}
const decl = (block: string, prop: string) => new RegExp(`${prop}\\s*:\\s*([^;]+)`).exec(block)?.[1]?.trim() ?? null;

const FACES = [
  ["Space Grotesk", "space-grotesk", [500, 600, 700]],
  ["Be Vietnam Pro", "be-vietnam-pro", [400, 500, 600, 700]],
  ["JetBrains Mono", "jetbrains-mono", [400, 500]],
] as const;
const SUBSETS = ["latin", "latin-ext", "vietnamese"] as const;

describe("fonts (VNX-0709 AC1)", () => {
  it("ships every face in the latin, latin-ext and vietnamese subsets, and nothing else", () => {
    const expected = FACES.flatMap(([, file, weights]) => weights.flatMap((w) => SUBSETS.map((s) => `${file}-${s}-${w}-normal.woff2`)));
    expect(FONT_FILES.sort()).toEqual(expected.sort());
  });

  it("ships the OFL licence of each family", () => {
    const texts = Object.values(LICENCES);
    for (const name of ["Space Grotesk", "Be Vietnam Pro", "JetBrains Mono"]) {
      const licence = texts.find((t) => t.includes(`The ${name} Project Authors`));
      expect(licence, name).toBeDefined();
      expect(licence, name).toContain("SIL Open Font License, Version 1.1");
    }
  });

  it("declares @font-face for the 9 faces, with swap, a unicode-range and a local woff2 per subset", async () => {
    const css = await text("/assets/app.css");
    const faces = atBlocks(css, "font-face").map((b) => b.body);
    const seen = new Set<string>();
    for (const face of faces) {
      const family = decl(face, "font-family")?.replace(/["']/g, "");
      const weight = decl(face, "font-weight");
      seen.add(`${family} ${weight}`);
      expect(decl(face, "font-display"), `${family} ${weight}`).toBe("swap");
      expect(decl(face, "unicode-range"), `${family} ${weight}`).toMatch(/^U\+/);
      const src = /url\(["']?\/assets\/fonts\/([^"')]+)["']?\)\s*format\(["']woff2["']\)/.exec(face)?.[1];
      expect(FONT_FILES, `${family} ${weight}`).toContain(src);
    }
    expect([...seen].sort()).toEqual(FACES.flatMap(([family, , weights]) => weights.map((w) => `${family} ${w}`)).sort());
    expect(faces).toHaveLength(FONT_FILES.length);
  });

  it("preloads exactly two fonts: Space Grotesk 700 latin and Be Vietnam Pro 400 latin", async () => {
    for (const path of ["/", "/products", "/vi/terms", "/login"]) {
      const head = headOf(await text(path));
      const preloads = head.match(/<link rel="preload"[^>]*>/g) ?? [];
      expect(preloads, path).toHaveLength(2);
      for (const file of ["space-grotesk-latin-700-normal.woff2", "be-vietnam-pro-latin-400-normal.woff2"]) {
        const link = preloads.find((l) => l.includes(`href="/assets/fonts/${file}"`));
        expect(link, `${path} ${file}`).toBeDefined();
        expect(link).toContain('as="font"');
        expect(link).toContain('type="font/woff2"');
        expect(link).toMatch(/\scrossorigin(=|>|\s)/);
      }
    }
  });

  it("keeps the font files under 400 KB in total", async () => {
    let total = 0;
    for (const file of FONT_FILES) {
      const res = await get(`/assets/fonts/${file}`);
      expect(res.status, file).toBe(200);
      total += (await res.arrayBuffer()).byteLength;
    }
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThanOrEqual(400 * 1024);
  });

  it("falls back to system CJK fonts and never downloads one", async () => {
    const css = await text("/assets/app.css");
    for (const name of ["PingFang SC", "PingFang TC", "Microsoft YaHei", "Microsoft JhengHei", "Noto Sans CJK SC", "Noto Sans CJK TC"]) {
      expect(css, name).toContain(`"${name}"`);
    }
    expect(css).not.toMatch(/url\([^)]*(noto|cjk|pingfang)/i);
  });
});

describe("no third-party requests (VNX-0709 AC2)", () => {
  it("app.css loads nothing from another host", async () => {
    const css = await text("/assets/app.css");
    expect(css).not.toMatch(/@import/);
    expect(css).not.toMatch(/url\(\s*["']?(https?:)?\/\//);
    expect(css).not.toContain("fonts.googleapis.com");
    expect(css).not.toContain("fonts.gstatic.com");
  });

  it("every absolute URL in <head> is on APP_ORIGIN, and every script, stylesheet, icon and preload is same-origin", async () => {
    for (const path of ["/", "/vi/", "/products", "/zh-hant/terms", "/login", "/vi/no-such-page"]) {
      const html = await (await get(path)).text();
      // JSON-LD is data, not a request: its schema.org @context is skipped.
      const head = headOf(html).replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, "");
      for (const m of head.matchAll(/(?:href|src|content)="(https?:\/\/[^"]*)"/g)) {
        expect(new URL(m[1]!).host, `${path} ${m[1]}`).toBe("vnx.si");
      }
      expect(html, path).not.toContain("fonts.googleapis.com");
      for (const m of html.matchAll(/<(?:script|img|iframe)[^>]*\ssrc="([^"]*)"/g)) expect(m[1], path).toMatch(/^\/(?!\/)/);
      for (const m of html.matchAll(/<link rel="(?:stylesheet|preload|icon|preconnect|dns-prefetch)"[^>]*\shref="([^"]*)"/g)) {
        expect(m[1], path).toMatch(/^\/(?!\/)/);
      }
    }
  });
});

describe("motion (VNX-0709 AC10)", () => {
  it("defines the fadeUp, ping and belt keyframes", async () => {
    const css = await text("/assets/app.css");
    for (const name of ["fadeUp", "ping", "belt"]) expect(atBlocks(css, "keyframes").map((b) => b.prelude), name).toContain(name);
  });

  it("turns off every animation and transition under prefers-reduced-motion: reduce", async () => {
    const css = await text("/assets/app.css");
    const reduce = atBlocks(css, "media").filter((b) => /prefers-reduced-motion:\s*reduce/.test(b.prelude));
    expect(reduce.length).toBeGreaterThan(0);
    const body = reduce.map((b) => b.body).join("\n");
    for (const selector of [".reveal", ".reveal-scroll", ".ping", ".belt-track", ".deck-card", ".lift", ".btn"]) {
      expect(body, selector).toContain(selector);
    }
    expect(body).toMatch(/animation:\s*none/);
    expect(body).toMatch(/transition:\s*none/);
  });

  it("runs the scroll reveal only inside @supports (animation-timeline: view()), never hiding content elsewhere", async () => {
    const css = await text("/assets/app.css");
    const supports = atBlocks(css, "supports").filter((b) => /animation-timeline:\s*view\(\)/.test(b.prelude));
    expect(supports).toHaveLength(1);
    expect(supports[0]!.body).toContain(".reveal-scroll");
    expect(supports[0]!.body).toMatch(/animation-timeline:\s*view\(\)/);
    const outside = css.replace(supports[0]!.body, "");
    expect(outside).not.toMatch(/animation-timeline/);
    // Outside @supports, .reveal-scroll has no rule that could leave it invisible.
    for (const m of outside.matchAll(/([^{}]*\.reveal-scroll[^{}]*)\{([^}]*)\}/g)) {
      if (/prefers-reduced-motion/.test(m[1]!)) continue;
      expect(m[2], m[1]).not.toMatch(/opacity\s*:\s*0|visibility\s*:\s*hidden|display\s*:\s*none/);
    }
  });

  it("landing.js stops rotating under prefers-reduced-motion", async () => {
    const js = await text("/assets/landing.js");
    expect(js).toMatch(/matchMedia\(\s*["']\(prefers-reduced-motion: reduce\)["']\s*\)/);
  });
});

describe("landing.js (VNX-0709 AC11)", () => {
  it("is at most 2 KB, with no imports, no libraries and no network calls", async () => {
    const res = await get("/assets/landing.js");
    expect(res.status).toBe(200);
    const bytes = (await res.arrayBuffer()).byteLength;
    expect(bytes).toBeGreaterThan(0);
    expect(bytes).toBeLessThanOrEqual(2048);
    const js = await text("/assets/landing.js");
    expect(js).not.toMatch(/\bimport\b|\brequire\(/);
    expect(js).not.toMatch(/\bfetch\(|XMLHttpRequest|sendBeacon|https?:\/\//);
  });

  it("is loaded with defer on the landing page only", async () => {
    for (const path of ["/", "/vi/", "/zh-hans/", "/zh-hant/", "/?joined=1"]) {
      const html = await text(path);
      expect(html.match(/<script[^>]*src="\/assets\/landing\.js"[^>]*>/g), path).toEqual([expect.stringMatching(/\sdefer(=|>|\s)/)]);
    }
    for (const path of ["/products", "/builders", "/vi/terms", "/login"]) {
      expect(await text(path), path).not.toContain("landing.js");
    }
  });
});
