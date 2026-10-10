// Inquiry form of a public builder, signed out (Turnstile, fake driver). POST budget: the IP limit is 10 an hour and this file sends 3.
import { MAIN } from "../seed/fixtures.mjs";
import { fillFakeTurnstile } from "../support/turnstile";
import { expect, test } from "../support/test";

const PATH = `/b/${MAIN.handle}/hire`;
const MESSAGE = "I need a small booking tool for my studio, with a calendar and email reminders.";

async function fillValid(page: import("@playwright/test").Page) {
  await page.getByLabel("Message").fill(MESSAGE);
  await page.getByLabel("Your name").fill("Ada Tester");
  await page.getByLabel("Your e-mail").fill("ada.client@example.test");
}

const post = (page: import("@playwright/test").Page) => page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === PATH);

test("the form labels every field and carries the Turnstile widget", async ({ page }) => {
  await page.goto(PATH);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(MAIN.name);
  await expect(page.getByLabel("Message")).toBeVisible();
  await expect(page.getByLabel("Budget")).toBeVisible();
  await expect(page.getByLabel("Deadline (optional)")).toBeVisible();
  await expect(page.getByLabel("Your name")).toBeVisible();
  await expect(page.getByLabel("Your e-mail")).toBeVisible();
  // No field without a label (the honeypot has one too, and is hidden from people).
  const unlabeled = await page.locator("form input:not([type=hidden]), form textarea, form select").evaluateAll((els) => els.filter((e) => (e as HTMLInputElement).labels?.length === 0).map((e) => e.outerHTML));
  expect(unlabeled).toEqual([]);
  await expect(page.locator("form div.cf-turnstile")).toHaveAttribute("data-sitekey", "fake-site-key");
});

test("an empty form is refused per field and keeps what was typed", async ({ page }) => {
  await page.goto(PATH);
  // The browser would stop an empty required field first: switch its check off to reach the server rules.
  await page.locator("form").evaluate((f) => ((f as HTMLFormElement).noValidate = true));
  await page.getByLabel("Your name").fill("Ada Tester");
  await page.getByLabel("Your e-mail").fill("ada.client@example.test");
  const [res] = await Promise.all([post(page), page.getByRole("button", { name: "Send inquiry" }).click()]);
  expect(res.status()).toBe(400);
  const message = page.getByLabel("Message");
  await expect(message).toHaveAttribute("aria-invalid", "true");
  const errorId = await message.getAttribute("aria-describedby");
  expect(errorId).toBe("iq-message-error");
  const error = page.locator(`#${errorId}`);
  await expect(error).not.toBeEmpty();
  // VNX-0807: no live-region role on the field error (the focused summary announces it); the summary carries it instead.
  await expect(error).not.toHaveAttribute("role", "alert");
  await expect(page.locator("#form-errors")).toContainText("Message:");
  await expect(page.getByLabel("Your name")).toHaveValue("Ada Tester");
  await expect(page.getByLabel("Your e-mail")).toHaveValue("ada.client@example.test");
  await expect(page.getByRole("heading", { name: "Check your inbox" })).toHaveCount(0);
});

test("a form without the Turnstile token is refused and creates nothing", async ({ page }) => {
  await page.goto(PATH);
  await fillValid(page);
  const [res] = await Promise.all([post(page), page.getByRole("button", { name: "Send inquiry" }).click()]);
  expect(res.status()).toBe(400);
  // A form-level error (it belongs to no field) is a line of the summary without a link.
  const summary = page.locator("#form-errors");
  await expect(summary.getByRole("listitem").filter({ hasText: "Please complete the check below" })).toBeVisible();
  await expect(summary.getByRole("link")).toHaveCount(0);
  await expect(page).toHaveTitle(/^Error: /);
  await expect(page.getByRole("heading", { name: "Check your inbox" })).toHaveCount(0);
  await expect(page.getByLabel("Message")).toHaveValue(MESSAGE);
});

test("a valid form with the token ends on the check-your-inbox page", async ({ page }) => {
  const get = await page.goto(PATH);
  // Regression: the form page must not send no-referrer (the browser would then send Origin: null on the POST and the server answers 403).
  expect(get!.headers()["referrer-policy"]).not.toBe("no-referrer");
  await fillValid(page);
  await fillFakeTurnstile(page);
  const [res, request] = await Promise.all([post(page), page.waitForRequest((r) => r.method() === "POST"), page.getByRole("button", { name: "Send inquiry" }).click()]);
  expect(request.headers()["origin"]).toBe(new URL(page.url()).origin);
  expect(res.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
  await expect(page.getByText("ada.client@example.test")).toBeVisible();
});
