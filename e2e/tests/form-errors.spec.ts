// The shared error pattern of server-rendered forms (VNX-0807, WCAG 3.3.1 / 3.3.3 / 2.4.2): the <title> starts with the error prefix,
// focus lands on the summary (autofocus, no JavaScript), each summary link moves focus to its field, what was typed is kept.
// Login follows the same pattern and is covered in login.spec.ts (VNX-0807 T6, after EPIC 26).
// POST budget: invalid forms are rejected before any rate limit counts them, so these tests spend none.
import type { Page } from "@playwright/test";
import { MAIN } from "../seed/fixtures.mjs";
import { scanA11y } from "../support/a11y";
import { expect, test } from "../support/test";

test.use({ reducedMotion: "reduce" });

type Locale = { prefix: string; title: string; path: string };
const EN = { prefix: "Error:", title: "There is a problem", path: "" };
const VI = { prefix: "Lỗi:", title: "Có lỗi cần sửa", path: "/vi" };

/** Switches the browser's own required-field check off, so the server rules are reached. */
const skipBrowserValidation = (page: Page, form: string) => page.locator(form).evaluate((f) => ((f as HTMLFormElement).noValidate = true));

const submit = (page: Page, path: string, button: string | RegExp) =>
  Promise.all([page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === path), page.getByRole("button", { name: button }).click()]).then(([res]) => res);

/**
 * Everything the pattern promises on a form page that came back with errors. Returns the summary links' targets.
 * `linkedField` is the control the first link must focus.
 */
async function expectErrorPattern(page: Page, l: Pick<Locale, "prefix" | "title">, linkedField: string): Promise<void> {
  await expect(page).toHaveTitle(new RegExp(`^${l.prefix} `));
  const summary = page.locator("#form-errors");
  await expect(summary).toBeVisible();
  await expect(summary.getByRole("heading", { level: 2 })).toHaveText(l.title);
  // Focus is on the summary on load, with no script: it is what makes a screen reader read the heading and the list.
  await expect(summary).toBeFocused();
  // One link per field error, in page order, and every one points at a control that exists.
  const fieldErrors = await page.locator("p.error-msg").count();
  expect(fieldErrors).toBeGreaterThan(0);
  const links = summary.getByRole("link");
  await expect(links).toHaveCount(fieldErrors);
  const hrefs = await links.evaluateAll((els) => els.map((e) => e.getAttribute("href")!));
  for (const href of hrefs) await expect(page.locator(href), href).toHaveCount(1);
  // The summary is the only live announcement: no role="alert" left on the page.
  await expect(page.locator("[role=alert]")).toHaveCount(0);
  // Clicking the first link puts focus into the field.
  await links.first().click();
  await expect(page.locator(linkedField)).toBeFocused();
}

for (const l of [EN, VI]) {
  test(`${l.path || "/en"} inquiry form: empty message and name`, async ({ page }) => {
    const path = `${l.path}/b/${MAIN.handle}/hire`;
    await page.goto(path);
    await skipBrowserValidation(page, "form[method=post]");
    await page.locator("#iq-email").fill("ada.client@example.test");
    const res = await submit(page, path, /./);
    expect(res.status()).toBe(400);
    await expectErrorPattern(page, l, "#iq-message");
    // What was typed is kept.
    await expect(page.locator("#iq-email")).toHaveValue("ada.client@example.test");
    // The 400 page itself is clean for axe (EN only: one scan is enough for the pattern; VI uses the same markup).
    if (l === EN) await scanA11y(page, { page: "/b/:handle/hire (400)", locale: "en" });
  });
}

test("request form: several fields at once, languages link to their first checkbox", async ({ page }) => {
  await page.goto("/request");
  await skipBrowserValidation(page, "form[method=post]");
  await page.locator("#rq-name").fill("Ada Tester");
  await page.locator("#rq-email").fill("ada.client@example.test");
  const res = await submit(page, "/request", /./);
  expect(res.status()).toBe(400);
  await expectErrorPattern(page, EN, "#rq-title");
  await expect(page.locator("#form-errors a[href='#rq-languages']")).toHaveCount(1);
  await expect(page.locator("#rq-name")).toHaveValue("Ada Tester");
});

for (const l of [EN, VI]) {
  test(`${l.path || "/en"} contact form: nothing filled in`, async ({ page }) => {
    const path = `${l.path}/contact`;
    await page.goto(path);
    await skipBrowserValidation(page, "form.contact-form");
    await page.locator("#ct-name").fill("Ada Tester");
    const res = await submit(page, path, /./);
    expect(res.status()).toBe(400);
    // The role group links to its first radio.
    await expectErrorPattern(page, l, "#ct-role-builder");
    await expect(page.locator("#ct-name")).toHaveValue("Ada Tester");
  });
}
