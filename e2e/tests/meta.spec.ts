// The tools must be able to fail: an axe scan that finds nothing and a CSP listener that hears nothing look the same as a clean app.
// This spec uses the plain Playwright test API (no auto CSP assertion) because it causes violations on purpose.
import { expect, test } from "@playwright/test";
import { axeViolations, scanA11y, settle } from "../support/a11y";
import { KNOWN_A11Y, type KnownA11y } from "../support/a11y-known";
import { watchCsp } from "../support/csp";
import { allowSameOriginFailure, watchSameOriginFailures } from "../support/network";

test("axe reports a missing image alt (the scan is not empty)", async ({ page }) => {
  await page.setContent('<!doctype html><html lang="en"><head><title>x</title></head><body><main><h1>Test</h1><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></main></body></html>');
  const violations = await axeViolations(page);
  expect(violations.map((v) => v.id)).toContain("image-alt");
});

test("watchCsp hears an inline script blocked by the app CSP and a console.error", async ({ page }) => {
  const watch = await watchCsp(page);
  await page.goto("/privacy");
  await page.evaluate(() => {
    const s = document.createElement("script");
    s.textContent = "window.__ran = true";
    document.head.appendChild(s);
    console.error("e2e meta console error");
  });
  await expect.poll(() => watch.violations.length).toBeGreaterThan(0);
  expect(watch.violations[0]).toContain("script-src");
  expect(await page.evaluate(() => (window as unknown as { __ran?: boolean }).__ran)).toBeUndefined();
  expect(watch.errors.join("\n")).toContain("e2e meta console error");
});

const lowContrast = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    // CSSOM, not a style attribute: the app CSP forbids inline style markup but not this.
    const p = document.createElement("p");
    p.textContent = "Low contrast probe text";
    p.style.color = "#cccccc";
    p.style.backgroundColor = "#ffffff";
    document.querySelector("main")!.prepend(p);
  });

test("axe reads real app pages: it reports a contrast failure injected into /privacy", async ({ page }) => {
  await page.goto("/privacy");
  await lowContrast(page);
  const violations = await axeViolations(page);
  expect(violations.map((v) => v.id)).toContain("color-contrast");
});

test("scanA11y: a deferral covers its violation, and a deferral that matches nothing fails", async ({ page }) => {
  await page.goto("/privacy");
  await lowContrast(page);
  const key = { page: "/meta-probe", locale: "en" } as const;
  const known = KNOWN_A11Y as KnownA11y[];
  const mark = known.length;
  try {
    await expect(scanA11y(page, key), "unlisted violation fails").rejects.toThrow(/color-contrast/);
    known.push({ ...key, ruleId: "color-contrast", reason: "meta test", finding: "META-1" });
    await scanA11y(page, key); // listed: passes
    known.push({ ...key, ruleId: "image-alt", reason: "meta test", finding: "META-2" });
    await expect(scanA11y(page, key), "stale entry fails").rejects.toThrow(/META-2/);
  } finally {
    known.length = mark;
  }
});

test("settle stops with E2E infrastructure when a same-origin asset fails, unless the test named the abort", async ({ page, baseURL }) => {
  watchSameOriginFailures(page, baseURL!);
  await page.route(/\/assets\/landing\.js$/, (route) => route.abort());
  await page.goto("/");
  await expect(settle(page)).rejects.toThrow(/E2E infrastructure: .*\/assets\/landing\.js failed \(net::ERR_FAILED\)/);
  // The same abort, named: the page settles.
  const page2 = await page.context().newPage();
  watchSameOriginFailures(page2, baseURL!);
  await page2.route(/\/assets\/landing\.js$/, (route) => route.abort());
  allowSameOriginFailure(page2, /\/assets\/landing\.js$/);
  await page2.goto("/");
  await settle(page2);
});
