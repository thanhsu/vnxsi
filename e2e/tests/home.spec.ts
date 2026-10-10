// Mirrors the Owner's manual checklist of M7 Task 8b (chart growth, count-up, Live strip, tooltip, reduced motion, no JS).
// The homepage snapshot is real: global-setup runs the hourly cron over the seeded tables.
import { computed, formatEn, moveMouseAway, scrollToCenter } from "../support/page";
import { expect, test } from "../support/test";

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

test("count-up ends on the printed value", async ({ page }) => {
  await page.goto("/");
  const counts = page.locator("[data-count]");
  const n = await counts.count();
  expect(n).toBeGreaterThanOrEqual(2);
  for (let i = 0; i < n; i++) {
    const el = counts.nth(i);
    await scrollToCenter(el);
    const target = await el.getAttribute("data-count");
    // The animation lasts 1200 ms; poll the final text instead of sleeping.
    await expect(el, `count ${target}`).toHaveText(formatEn(target!), { timeout: 3_000 });
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
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const counts = page.locator("[data-count]");
    const n = await counts.count();
    expect(n).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < n; i++) {
      const target = await counts.nth(i).getAttribute("data-count");
      await expect(counts.nth(i)).toHaveText(formatEn(target!), { timeout: 500 });
    }
    await expect(page.locator(".home-marquee-track"), "home.js leaves the list alone").toHaveCount(0);
    await expect(page.locator("[data-motion-toggle]")).toBeHidden();
    expect(await computed(page.locator(".chart-bar"), "animation-name")).toBe("none");
    expect(await computed(page.locator(".chart-line"), "animation-name")).toBe("none");
  });
});

test.describe("JavaScript off", () => {
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
