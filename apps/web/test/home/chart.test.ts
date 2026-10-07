import { describe, expect, it } from "vitest";
import { LOCALES } from "../../src/i18n/locales.ts";
import { t } from "../../src/i18n/t.ts";
import { BAR_HEIGHT, CHART_WIDTH, MARKER_MIN_STEP, barLayout, lineLayout } from "../../src/views/chart-geometry.ts";
import { PATH_LENGTH, formatWeek, formatWeeks, weekStart } from "../../src/views/format.ts";
import { CATEGORY_KEY } from "../../src/views/labels.ts";
import { block, getHome, seedSnapshot } from "./blocks.ts";

describe("barLayout", () => {
  it("scales every bar to the largest value, keeps zero at width 0, and never overlaps groups", () => {
    const g = barLayout([[4, 1], [2, 0]]);
    const full = g.rows[0]!.bars[0]!.width;
    expect(full).toBeGreaterThan(0);
    expect(full).toBeLessThan(CHART_WIDTH);
    expect(g.rows[1]!.bars[0]!.width).toBeCloseTo(full / 2, 0);
    expect(g.rows[1]!.bars[1]!.width).toBe(0);
    expect(g.rows[1]!.top).toBeGreaterThanOrEqual(g.rows[0]!.top + g.rows[0]!.height);
    expect(g.rows[0]!.bars[1]!.y).toBeGreaterThanOrEqual(g.rows[0]!.bars[0]!.y + BAR_HEIGHT);
    const last = g.rows[1]!;
    expect(g.height).toBeGreaterThan(last.top + last.height);
  });
  it("an all-zero or empty input does not divide by zero", () => {
    expect(barLayout([[0, 0]]).rows[0]!.bars.map((b) => b.width)).toEqual([0, 0]);
    expect(barLayout([]).rows).toEqual([]);
  });
});

describe("lineLayout", () => {
  it("puts the maximum on the top tick and zero on the baseline, x evenly spaced", () => {
    const g = lineLayout([[1, 2, 4, 8], [0, 1, 1, 2]]);
    const [zero, max] = g.ticks;
    expect(zero!.value).toBe(0);
    expect(max!.value).toBe(8);
    expect(g.lines[0]![3]!.y).toBe(max!.y);
    expect(g.lines[1]![0]!.y).toBe(zero!.y);
    expect(g.lines[0]).toHaveLength(4);
    g.x.slice(1).forEach((x, i) => expect(Math.abs(x - g.x[i]! - g.step)).toBeLessThanOrEqual(0.1));
  });
  it("a dense series is below the marker step, so only the endpoints get a marker", () => {
    expect(lineLayout([Array<number>(40).fill(1)]).step).toBeLessThan(MARKER_MIN_STEP);
    expect(lineLayout([[1, 2, 3, 4]]).step).toBeGreaterThanOrEqual(MARKER_MIN_STEP);
  });
  it("a single point does not divide by zero", () => {
    expect(Number.isFinite(lineLayout([[3]]).lines[0]![0]!.x)).toBe(true);
  });
});

describe("week labels", () => {
  it("weekStart is the Monday of the ISO week, including a week that starts in the previous year", () => {
    expect(weekStart("2026-W40")!.toISOString().slice(0, 10)).toBe("2026-09-28");
    expect(weekStart("2026-W01")!.toISOString().slice(0, 10)).toBe("2025-12-29");
    expect(weekStart("2027-W01")!.toISOString().slice(0, 10)).toBe("2027-01-04");
    expect(weekStart("nonsense")).toBeNull();
  });
  it("formatWeek prints a locale date, never the raw key, and falls back to the input", () => {
    expect(formatWeek("en", "2026-W40")).toBe("Sep 28");
    for (const l of LOCALES) expect(formatWeek(l, "2026-W40"), l).not.toContain("W40");
    expect(formatWeek("en", "bad")).toBe("bad");
  });
  it("formatWeeks adds the year to every label only when the weeks span two years", () => {
    expect(formatWeeks("en", ["2026-W40", "2026-W41"])).toEqual(["Sep 28", "Oct 5"]);
    const across = formatWeeks("en", ["2026-W52", "2027-W01"]);
    expect(across[0]).toContain("2026");
    expect(across[1]).toContain("2027");
    expect(formatWeeks("en", [])).toEqual([]);
  });
});

describe("Market pulse charts on /", () => {
  const svgs = (html: string) => html.match(/<svg class="chart-svg"[\s\S]*?<\/svg>/g)!;
  const rowsOf = (html: string, kind: string) => html.match(new RegExp(`data-chart="${kind}"[\\s\\S]*?</table>`))![0].match(/<th scope="row">/g)!.length;

  it("draws two SVG charts, each with a legend and its table inside a closed <details>", async () => {
    await seedSnapshot();
    const html = block(await getHome(), "home-pulse");
    expect(svgs(html)).toHaveLength(2);
    expect(html.match(/<ul class="chart-legend">/g)).toHaveLength(2);
    for (const kind of ["requests-by-category", "growth"]) {
      expect(html).toMatch(new RegExp(`<details class="chart-data">\\s*<summary>[^<]+</summary>[\\s\\S]*?<table class="data" data-chart="${kind}"`));
    }
    expect(html).not.toMatch(/<details[^>]*\sopen/);
  });
  it("each svg is role=img with a label, holds no focusable element, no style=, and no colour on <text>", async () => {
    await seedSnapshot();
    for (const svg of svgs(block(await getHome(), "home-pulse"))) {
      expect(svg).toMatch(/aria-label="[^"]+"/);
      expect(svg).toContain('role="img"');
      expect(svg).not.toMatch(/tabindex|\sstyle=|<a\b|<button/);
      expect(svg).not.toMatch(/<text[^>]*\s(fill|stroke)=/);
    }
  });
  it("the bar chart has one group per category; the growth chart two lines and one dot per week and series", async () => {
    await seedSnapshot();
    const html = block(await getHome(), "home-pulse");
    const [bars, line] = svgs(html);
    expect(bars!.match(/class="chart-group"/g)).toHaveLength(rowsOf(html, "requests-by-category"));
    for (const key of ["crm", "booking", "ecommerce"] as const) expect(bars).toContain(t("en", CATEGORY_KEY[key]));
    expect(line!.match(/class="chart-cross"/g)).toHaveLength(rowsOf(html, "growth"));
    expect(line!.match(/class="chart-line /g)).toHaveLength(2);
    expect(line!.match(/class="chart-dot /g)).toHaveLength(rowsOf(html, "growth") * 2); // 4 weeks: step is above MARKER_MIN_STEP, so every point has a marker
    expect(line).toContain(`pathLength="${PATH_LENGTH}"`);
  });
  it("the growth table and axis show a localised week start, not the ISO key", async () => {
    await seedSnapshot();
    const html = block(await getHome(), "home-pulse");
    expect(html).not.toMatch(/\d{4}-W\d{2}/);
    expect(html).toContain("Sep 28");
  });
  it("the Trending sparkline carries pathLength", async () => {
    await seedSnapshot();
    expect(block(await getHome(), "home-trending")).toMatch(new RegExp(`<polyline[^>]*pathLength="${PATH_LENGTH}"`));
  });
});
