// Mirrors the Owner's manual checklist of M7 Task 8b (chart growth, count-up, Live strip, tooltip, reduced motion, no JS).
// The homepage snapshot is real: global-setup runs the hourly cron over the seeded tables.
import type { Page } from "@playwright/test";
import { computed, formatEn, moveMouseAway, scrollToCenter } from "../support/page";
import { expect, test } from "../support/test";

/**
 * The server prints the final number inside every [data-count], so checking only the final text would pass without any animation.
 * This records every text each [data-count] shows (a MutationObserver from before the first script), so a test can see the values in between.
 * Call before goto. history[i] is the list of texts of the i-th [data-count], in order, without repeats.
 */
async function recordCounts(page: Page): Promise<() => Promise<string[][]>> {
  await page.addInitScript(() => {
    const history: string[][] = [];
    (window as unknown as { __countHistory: string[][] }).__countHistory = history;
    const snap = () =>
      document.querySelectorAll("[data-count]").forEach((el, i) => {
        const list = (history[i] ??= []);
        const text = el.textContent ?? "";
        if (list[list.length - 1] !== text) list.push(text);
      });
    new MutationObserver(snap).observe(document, { subtree: true, childList: true, characterData: true });
    document.addEventListener("DOMContentLoaded", snap);
  });
  return () => page.evaluate(() => (window as unknown as { __countHistory: string[][] }).__countHistory);
}

const BLOCKS = ["home-numbers", "home-live", "home-trending", "home-pulse", "home-builders", "home-products"];

test("every data block renders with a heading and no placeholder text", async ({ page }) => {
  await page.goto("/");
  for (const id of BLOCKS) {
    const block = page.locator(`#${id}`);
    await expect(block, id).toBeAttached();
    await expect(block.getByRole("heading", { level: 2 }), `${id} heading`).toHaveCount(1);
  }
  await expect(page.locator("#home-founding"), "Founding products stands in only when Trending is empty").toHaveCount(0);
  expect(await page.locator(".home-numbers li").count()).toBeGreaterThanOrEqual(2);
  const charts = page.locator("svg.chart-svg[role=img]");
  expect(await charts.count()).toBeGreaterThanOrEqual(2);
  for (const label of await charts.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")))) expect(label, "chart aria-label").toBeTruthy();
  const text = await page.locator(".home-block").allInnerTexts();
  expect(text.join("\n")).not.toMatch(/\b(undefined|NaN|null)\b/);
});

test("count-up runs through values and ends on the printed value", async ({ page }) => {
  const history = await recordCounts(page);
  await page.goto("/");
  const counts = page.locator("[data-count]");
  const n = await counts.count();
  expect(n).toBeGreaterThanOrEqual(2);
  for (let i = 0; i < n; i++) {
    const el = counts.nth(i);
    await scrollToCenter(el);
    const final = formatEn((await el.getAttribute("data-count"))!);
    // The animation lasts 1200 ms; poll the recorded texts instead of sleeping: it must have shown a different NUMBER than the final one (an empty or placeholder text in between is not a count-up), and end on the final one.
    await expect
      .poll(async () => {
        const seen = (await history())[i] ?? [];
        return { moved: seen.some((t) => /\d/.test(t) && t !== final), last: seen[seen.length - 1] };
      }, { message: `count ${final}`, timeout: 4_000 })
      .toEqual({ moved: true, last: final });
  }
});

test("Live strip: runs, pauses on hover and with the button, stops and shows the link on focus", async ({ page }) => {
  await page.goto("/");
  const track = page.locator(".home-marquee-track");
  await expect(track).toHaveCount(1);
  await scrollToCenter(track);
  expect(await computed(track, "animation-name")).toBe("belt");
  await expect.poll(() => computed(track, "animation-play-state")).toBe("running");

  await page.locator(".home-marquee").hover();
  await expect.poll(() => computed(track, "animation-play-state"), { message: "hover pauses" }).toBe("paused");
  await moveMouseAway(page);
  await expect.poll(() => computed(track, "animation-play-state"), { message: "leaving resumes" }).toBe("running");

  const toggle = page.locator("[data-motion-toggle]");
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".home-marquee")).toHaveClass(/is-paused/);
  await expect.poll(() => computed(track, "animation-play-state"), { message: "button pauses" }).toBe("paused");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await moveMouseAway(page);
  await expect.poll(() => computed(track, "animation-play-state"), { message: "button resumes" }).toBe("running");

  // Keyboard: a link in the live list stops the strip (focus-within) so it can be read and used.
  const link = page.locator(".home-marquee-track > ul a").first();
  await link.focus();
  await expect.poll(() => computed(track, "animation-name"), { message: "focus stops the strip" }).toBe("none");
  await expect(link).toBeInViewport();
  await link.blur();

  // The copy that makes the loop is invisible to assistive tech and unreachable by keyboard.
  const copy = page.locator(".home-marquee-track > ul[aria-hidden='true']");
  await expect(copy).toHaveCount(1);
  expect(await copy.evaluate((el) => (el as HTMLElement).inert)).toBe(true);
  const tabindexes = await copy.locator("a, button").evaluateAll((els) => els.map((e) => e.getAttribute("tabindex")));
  expect(tabindexes.length).toBeGreaterThan(0);
  expect(tabindexes.every((t) => t === "-1")).toBe(true);
});

test("chart bars grow when scrolled into view", async ({ page }) => {
  await page.goto("/");
  expect(await page.evaluate(() => CSS.supports("animation-timeline: view()"))).toBe(true);
  const bars = page.locator("figure[data-chart-kind=bars] .chart-bar");
  expect(await bars.count()).toBeGreaterThan(0);
  expect(await computed(bars, "animation-name")).toBe("chart-grow");
  await scrollToCenter(page.locator("figure[data-chart-kind=bars]"));
  // A bar of value 0 has width 0 by design: every bar that has a width in the markup must have one on screen once it is in view.
  await expect
    .poll(() => bars.evaluateAll((els) => els.filter((e) => Number(e.getAttribute("width")) > 0).every((e) => e.getBoundingClientRect().width > 0)), {
      message: "every non-empty bar has width once it is in view",
    })
    .toBe(true);
  expect(await bars.evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().width > 0).length)).toBeGreaterThan(0);
});

test("chart tooltip shows the group text and Escape hides it", async ({ page }) => {
  await page.goto("/");
  const group = page.locator(".chart-group").first();
  await scrollToCenter(group);
  const expected = await group.getAttribute("data-tip");
  expect(expected).toBeTruthy();
  await group.hover();
  const tip = page.locator(".chart-tip");
  await expect(tip).toBeVisible();
  await expect(tip).toHaveText(expected!);
  await expect(tip).toHaveAttribute("aria-hidden", "true");
  await page.keyboard.press("Escape");
  await expect(tip).toBeHidden();
  await expect(tip).toHaveAttribute("hidden", "");
});

test.describe("reduced motion", () => {
  test("numbers are final at once, no strip, no motion on charts", async ({ page }) => {
    const history = await recordCounts(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const counts = page.locator("[data-count]");
    const n = await counts.count();
    expect(n).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < n; i++) {
      const el = counts.nth(i);
      await scrollToCenter(el); // the observer that would start the count-up fires here
      const final = formatEn((await el.getAttribute("data-count"))!);
      await expect(el).toHaveText(final, { timeout: 500 });
    }
    // Never through 0 or any other value: every text each number ever showed is the final one.
    const seen = await history();
    expect(seen.length).toBe(n);
    for (const [i, list] of seen.entries()) {
      const final = formatEn((await counts.nth(i).getAttribute("data-count"))!);
      expect(list, `number ${i}`).toEqual([final]);
    }
    await expect(page.locator(".home-marquee-track"), "home.js leaves the list alone").toHaveCount(0);
    await expect(page.locator("[data-motion-toggle]")).toBeHidden();
    expect(await computed(page.locator(".chart-bar"), "animation-name")).toBe("none");
    expect(await computed(page.locator(".chart-line"), "animation-name")).toBe("none");
  });
});

test.describe("JavaScript off", () => {
  // With scripts off the init script of watchCsp does not run, so no securitypolicyviolation event is heard here (console errors still are).
  // There is no script left to violate the policy; the CSP header itself is asserted in the last test.
  test.use({ javaScriptEnabled: false });

  test("every block still has its content", async ({ page }) => {
    await page.goto("/");
    for (const id of BLOCKS) await expect(page.locator(`#${id}`), id).toBeAttached();
    const counts = page.locator("[data-count]");
    const n = await counts.count();
    expect(n).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < n; i++) await expect(counts.nth(i)).toHaveText(formatEn((await counts.nth(i).getAttribute("data-count"))!));
    await expect(page.locator("ul[data-marquee]")).toBeVisible();
    await expect(page.locator(".home-marquee-track")).toHaveCount(0);
    await expect(page.locator("[data-motion-toggle]")).toBeHidden();
    await expect(page.locator(".chart-tip")).toHaveCount(0);
    expect(await page.locator("details.chart-data table").count()).toBeGreaterThanOrEqual(2);
  });
});

test("security headers on the homepage", async ({ page }) => {
  const res = await page.goto("/");
  const headers = res!.headers();
  const csp = headers["content-security-policy"] ?? "";
  expect(csp).toContain("default-src 'self'");
  expect(csp).not.toContain("unsafe-inline");
  expect(csp).not.toContain("unsafe-eval");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
});
