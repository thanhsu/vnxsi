import { afterEach, describe, expect, it, vi } from "vitest";
import { writePublicStat } from "../../src/db/public-stats.ts";
import { testEnv } from "../helpers.ts";
import { MIN, NUMBER_KEYS, STALE_AFTER_MS, countStat, rankTrending } from "../../src/domain/public-stats.ts";
import { LOCALES, localizedPath } from "../../src/i18n/locales.ts";
import { en, type MessageKey } from "../../src/i18n/messages/en.ts";
import { vi as viMessages } from "../../src/i18n/messages/vi.ts";
import { zhHans } from "../../src/i18n/messages/zh-hans.ts";
import { zhHant } from "../../src/i18n/messages/zh-hant.ts";
import { createApp } from "../../src/app.ts";
import { signIn } from "../fixtures.ts";
import { t } from "../../src/i18n/t.ts";
import { formatChange, sparkPoints, SPARK_VIEWBOX } from "../../src/views/format.ts";
import { COUNT_MIN, DB, block, clearStats, fresh, getHome, seedSnapshot, spyDb, trendingCandidates } from "./blocks.ts";

afterEach(() => vi.restoreAllMocks());
const tile = (key: string) => `data-stat="${key}"`;
const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("format helpers", () => {
  it("formatChange signs; sparkPoints is one point per value", () => {
    expect(formatChange("en", 25)).toBe("+25%");
    expect(formatChange("en", -10)).toMatch(/^[-−]10%$/);
    const points = sparkPoints([0, 5, 10]).split(" ");
    expect(points).toHaveLength(3);
    const ys = (s: string) => s.split(" ").map((p) => p.split(",")[1]);
    expect(new Set(ys(sparkPoints([0, 0, 0]))).size).toBe(1); // a flat series is one horizontal line
    expect(ys(sparkPoints([0, 5, 10]))[2]).not.toBe(ys(sparkPoints([0, 5, 10]))[0]);
    expect(SPARK_VIEWBOX).toMatch(/^0 0 \d+ \d+$/);
  });
});

describe("homepage blocks under the landing (VNX-0703a)", () => {
  it("prints nothing of its own when no snapshot is fresh, and the landing is intact", async () => {
    await clearStats();
    const html = await getHome();
    expect(html).not.toContain("home-block");
    expect(html).toContain('<section id="ask"');
  });

  it("puts the data blocks after the #ask block, inside <main>", async () => {
    await seedSnapshot();
    const html = await getHome();
    expect(html.indexOf('<section id="ask"')).toBeGreaterThan(0);
    expect(html.indexOf('id="home-numbers"')).toBeGreaterThan(html.indexOf('<section id="ask"'));
    expect(html.indexOf("</main>")).toBeGreaterThan(html.indexOf('id="home-trending"'));
  });

  it("Numbers: each tile hides at n-1 and shows at n; the others stay", async () => {
    for (const key of NUMBER_KEYS) {
      await seedSnapshot();
      await writePublicStat(DB, key, countStat(COUNT_MIN[key] - 1, COUNT_MIN[key]), fresh());
      const under = await getHome();
      expect(under, key).not.toContain(tile(key));
      for (const other of NUMBER_KEYS.filter((k) => k !== key)) expect(under, `${key}/${other}`).toContain(tile(other));
      await writePublicStat(DB, key, countStat(COUNT_MIN[key], COUNT_MIN[key]), fresh());
      expect(await getHome(), key).toContain(tile(key));
    }
  });

  it("Numbers: one tile left hides the row, two tiles show it; 'Updated hourly' only with the row", async () => {
    const at = fresh();
    await clearStats();
    await writePublicStat(DB, "count_products", MIN.products, at);
    let html = await getHome();
    expect(block(html, "home-numbers")).toBe("");
    expect(html).not.toContain(t("en", "home.updatedHourly"));
    await writePublicStat(DB, "count_countries", MIN.countries, at);
    html = await getHome();
    expect(count(block(html, "home-numbers"), "data-stat=")).toBe(2);
    expect(block(html, "home-numbers")).toContain(t("en", "home.updatedHourly"));
  });

  it("Trending: 5 products at the score threshold hide it, 6 show it; one point under the score hides it", async () => {
    const now = new Date();
    await clearStats();
    await writePublicStat(DB, "trending", rankTrending(trendingCandidates(MIN.trendingItems - 1), now), fresh());
    expect(block(await getHome(), "home-trending")).toBe("");
    await writePublicStat(DB, "trending", rankTrending(trendingCandidates(MIN.trendingItems, MIN.trendingScore - 1), now), fresh());
    expect(block(await getHome(), "home-trending")).toBe("");
    await writePublicStat(DB, "trending", rankTrending(trendingCandidates(MIN.trendingItems), now), fresh());
    const html = block(await getHome(), "home-trending");
    expect(count(html, '<li class="home-tile"')).toBe(MIN.trendingItems);
    expect(count(html, "<polyline")).toBe(MIN.trendingItems);
    expect(html).toContain("<ol");
  });

  it("a snapshot older than 3 hours hides every block; a fresh one shows them", async () => {
    await seedSnapshot(new Date(Date.now() - STALE_AFTER_MS - 60_000).toISOString());
    let html = await getHome();
    expect(html).not.toContain("home-block");
    expect(html).not.toContain(t("en", "home.updatedHourly"));
    await seedSnapshot();
    html = await getHome();
    for (const id of ["home-numbers", "home-trending"]) expect(block(html, id), id).not.toBe("");
  });

  it("reads public_stats exactly once per request, signed in, with and without Trending, in at most 8 statements", async () => {
    const { cookie } = await signIn("home-reader@vnx.si");
    for (const seed of [true, false]) {
      if (seed) await seedSnapshot(); else await clearStats();
      const sql: string[] = [];
      await getHome("/", { ...testEnv, DB: spyDb(sql) }, cookie);
      expect(sql.filter((s) => /\bpublic_stats\b/.test(s))).toHaveLength(1);
      expect(sql.length).toBeLessThanOrEqual(8);
    }
  });

  it("a failing public_stats read never breaks the landing", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const html = await getHome("/", { ...testEnv, DB: spyDb([], "public_stats") });
    expect(html).toContain('<section id="ask"');
    expect(html).not.toContain("home-block");
    expect(error).toHaveBeenCalledWith(expect.stringContaining("home_blocks_failed"));
  });

  it("a fresh but malformed value drops the blocks, logs, and still returns the landing with 200", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await seedSnapshot();
    await writePublicStat(DB, "trending", { bad: true } as never, fresh()); // valid JSON, wrong shape: the view throws while rendering
    const res = await createApp().request(new Request("https://vnx.si/"), undefined, testEnv);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('<section id="ask"');
    expect(html).not.toContain("home-block");
    expect(error).toHaveBeenCalledWith(expect.stringContaining("home_blocks_failed"));
  });

  it("no home.* value in any locale holds a digit (numbers come from data or parameters)", () => {
    for (const [name, messages] of Object.entries({ en, vi: viMessages, zhHans, zhHant })) {
      for (const [key, value] of Object.entries(messages)) if (key.startsWith("home.")) expect(value, `${name} ${key}`).not.toMatch(/\d/);
    }
  });

  it("adds no <script>, no inline style and no inline handler (CSP; scripts are Task 8)", async () => {
    await clearStats();
    const scripts = (h: string) => h.match(/<script\b/g)?.length ?? 0;
    const empty = await getHome();
    await seedSnapshot();
    const full = await getHome();
    expect(scripts(full)).toBe(scripts(empty));
    const region = full.slice(full.indexOf('class="lp-section home-block'), full.indexOf("</main>"));
    expect(region).not.toMatch(/<script|\sstyle=|\son[a-z]+=/i);
  });

  it("has no sponsored or paid wording in any locale", async () => {
    await seedSnapshot();
    for (const locale of LOCALES) {
      const html = await getHome(localizedPath(locale, "/"));
      const region = html.slice(html.indexOf('class="lp-section home-block'), html.indexOf("</main>")).replace(/<[^>]*>/g, " ").replace(String(t(locale, "home.builders.noPay" as MessageKey)), "");
      expect(region.length, locale).toBeGreaterThan(0);
      expect(region, locale).not.toMatch(/sponsor|advert|promot|paid|quảng cáo|trả tiền|赞助|贊助|广告|廣告|付费|付費/i);
    }
  });

  it("every home.* key is used by a view, and the home views hold no digit (no invented number)", () => {
    const views = import.meta.glob("../../src/views/home/*.tsx", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    const files = Object.entries(views);
    expect(files.length).toBeGreaterThanOrEqual(4);
    const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/^import .*$/gm, "").replace(/<\/?h[1-6]\b/g, "");
    for (const [file, src] of files) expect(code(src), file).not.toMatch(/\d/);
    const shared = import.meta.glob("../../src/views/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    const all = Object.values(shared).join("\n");
    for (const key of Object.keys(en).filter((k) => k.startsWith("home."))) expect(all, key).toContain(`"${key}"`);
  });
});
