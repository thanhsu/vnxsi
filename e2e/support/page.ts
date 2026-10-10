import type { Locator, Page } from "@playwright/test";

/** Scrolls the element to the middle of the window at once (the site sets smooth scrolling, which would still be moving, and the tooltip hides on scroll). */
export async function scrollToCenter(locator: Locator): Promise<void> {
  await locator.evaluate((el) => el.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }));
}

/** The number formatting home.js and the server use for the English locale. */
export const formatEn = (n: number | string): string => new Intl.NumberFormat("en").format(Number(n));

/** Computed style value of the first match. */
export async function computed(locator: Locator, property: string): Promise<string> {
  return locator.first().evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), property);
}

/** Moves the mouse to the top-left corner, away from every control. */
export async function moveMouseAway(page: Page): Promise<void> {
  await page.mouse.move(0, 0);
}
