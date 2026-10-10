import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { KNOWN_A11Y, type KnownA11y } from "./a11y-known";
import { assertNoSameOriginFailures } from "./network";

// WCAG 2.2 AA (docs/blueprint/02-NFR.md). `wcag22aa` carries target-size (44 px is the project rule; axe checks the 24 px AA minimum).
export const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

export type Violation = { id: string; impact: string | null | undefined; help: string; targets: string[] };

/** Waits until the page has its landmark and its fonts, so contrast is measured on the final rendering. */
export async function settle(page: Page, opts: { motion?: boolean } = {}): Promise<void> {
  await page.locator("main").first().waitFor();
  // A same-origin request that failed (and the test did not abort on purpose) means the page under scan is not the page users get.
  assertNoSameOriginFailures(page);
  // An unstyled page gives false findings (target-size on bare links): say so instead of reporting them. A failed load of app.css is a network fault of the machine, not of the app.
  const styled = await page.evaluate(() => Array.from(document.styleSheets).some((s) => (s.href ?? "").endsWith("/assets/app.css") && s.cssRules.length > 0));
  if (!styled) throw new Error("E2E infrastructure: /assets/app.css did not load, the page is unstyled and cannot be scanned");
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  if (opts.motion) await finiteAnimationsDone(page);
}

/**
 * With motion allowed, colors measured in the middle of a fade or count-up are false findings (R5 of VNX-0807). Waits until every finite,
 * time-based animation has finished. Infinite ones (the Live strip) and scroll-driven ones (chart growth, tied to the scroll position, not to time) are left alone.
 */
async function finiteAnimationsDone(page: Page): Promise<void> {
  // One definition of "unfinished", installed in the page and used by both the wait and the error message.
  await page.evaluate(() => {
    (window as unknown as { __unfinished: () => Animation[] }).__unfinished = () =>
      document.getAnimations().filter((a) => a.timeline === document.timeline && a.effect?.getComputedTiming().iterations !== Infinity && a.playState !== "finished" && a.playState !== "idle");
  });
  try {
    await page.waitForFunction(() => (window as unknown as { __unfinished: () => Animation[] }).__unfinished().length === 0, undefined, { timeout: 5_000 });
  } catch {
    const left = await page.evaluate(() =>
      (window as unknown as { __unfinished: () => Animation[] }).__unfinished().map((a) => (a instanceof CSSAnimation ? a.animationName : a instanceof CSSTransition ? a.transitionProperty : "animation")),
    );
    throw new Error(`E2E infrastructure: finite animations still running after 5 s: ${left.join(", ")}`);
  }
}

/** Runs axe and returns the violations, with no policy applied. */
export async function axeViolations(page: Page): Promise<Violation[]> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  return results.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, targets: v.nodes.map((n) => n.target.join(" ")) }));
}

export type ScanKey = { page: string; locale: "en" | "vi"; variant?: "mobile" | "motion" | "nojs" };

const sameKey = (k: ScanKey, e: KnownA11y) => k.page === e.page && k.locale === e.locale && k.variant === e.variant;
const covers = (e: KnownA11y, v: Violation) => e.ruleId === v.id && (e.selector === undefined || v.targets.some((t) => t.includes(e.selector!)));

const describe = (v: Violation) => `${v.id} (${v.impact}): ${v.help}\n${v.targets.map((t) => `    ${t}`).join("\n")}`;

/**
 * axe scan of the current page. A violation fails the test unless a KNOWN_A11Y entry covers it; an entry for this page that
 * covers nothing also fails, so the deferral list can only shrink silently, never grow.
 */
export async function scanA11y(page: Page, key: ScanKey): Promise<void> {
  await settle(page, { motion: key.variant === "motion" });
  const violations = await axeViolations(page);
  const entries = KNOWN_A11Y.filter((e) => sameKey(key, e));
  const unexplained = violations.filter((v) => !entries.some((e) => covers(e, v)));
  const stale = entries.filter((e) => !violations.some((v) => covers(e, v)));
  const label = `${key.locale}:${key.page}${key.variant ? ` [${key.variant}]` : ""}`;
  expect(unexplained.map(describe), `axe violations on ${label}`).toEqual([]);
  expect(stale.map((e) => `${e.ruleId} ${e.selector ?? ""} (${e.finding})`), `KNOWN_A11Y entries on ${label} that no longer match a violation`).toEqual([]);
}
