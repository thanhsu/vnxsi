// EPIC 27 builder interest (VNX-2706a): the "I'm interested" form on /requests/:publicId and the Hub section, as the seeded approved builder (MAIN, builderPage:
// the session is a seeded cookie, no /login). One seeded listing per attempt (Q 6 + retry, open, no invitation, no interest), because an interest is one per builder and request.
// POST budget: `interest:builder:<MAIN>` is 10 a day and only a VALID form counts: this test sends one 400 (not counted) and one real interest (1), so at most 3 with E2E_RETRIES=2.
// The withdraw has no rate limit. Playwright runs files in name order with one worker; this file runs after a11y.spec.ts and request-board-forms.spec.ts.
import { id, PUBLISHED_PRODUCT, CLIENT, DRAFT_PRODUCT, OTHER_PRODUCT } from "../seed/fixtures.mjs";
import { scanA11y } from "../support/a11y";
import { expect, test } from "../support/test";

test.use({ reducedMotion: "reduce" });

test("a builder tells us they are interested, sees it on the Hub, and withdraws it", async ({ builderPage: page }) => {
  const attempt = 6 + test.info().retry;
  const publicId = id("Q", attempt);
  const path = `/requests/${publicId}`;
  const title = `E2E board request ${attempt}`;
  const res = await page.goto(path);
  expect(res!.status()).toBe(200);

  // (1) The form: a note and a select with the builder's own published product only.
  const block = page.locator("main section[aria-label='Next steps']");
  await expect(block.getByRole("heading", { level: 2, name: "Tell us you're interested" })).toBeVisible();
  await expect(block).toContainText("Only the VNX.SI team sees this.");
  await expect(block.locator("#ib-note")).toBeVisible();
  const options = await block.locator("#ib-product option").allTextContents();
  expect(options).toContain(PUBLISHED_PRODUCT.name);
  expect(options).not.toContain(OTHER_PRODUCT.name);
  expect(options).not.toContain(DRAFT_PRODUCT.name);
  expect(await block.locator("form").getAttribute("action")).toBe(`${path}/interest`);

  // (2) A 501-character note: 400 with the shared error pattern, the values kept, no fragment; not counted against the day.
  // The browser would cut the note at maxlength: drop it (and the validation) so the server's own limit is what is tested.
  await block.locator("form").evaluate((f) => ((f as HTMLFormElement).noValidate = true));
  await block.locator("#ib-note").evaluate((el) => el.removeAttribute("maxlength"));
  const long = "n".repeat(501);
  await block.locator("#ib-note").fill(long);
  await block.locator("#ib-product").selectOption({ label: PUBLISHED_PRODUCT.name });
  const refused = await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === `${path}/interest`),
    block.getByRole("button", { name: "I'm interested" }).click(),
  ]).then(([r]) => r);
  expect(refused.status()).toBe(400);
  await expect(page).toHaveTitle(/^Error: /);
  const summary = page.locator("#form-errors");
  await expect(summary.getByRole("heading", { level: 2 })).toHaveText("There is a problem");
  await expect(summary).toBeFocused();
  await expect(page.locator("[role=alert]")).toHaveCount(0);
  await expect(page.locator("#ib-note")).toHaveValue(long);
  await expect(page.locator("#ib-note")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#ib-product")).toHaveValue(PUBLISHED_PRODUCT.id);
  expect(new URL(page.url()).hash).toBe("");
  for (const action of await page.locator("main form").evaluateAll((forms) => forms.map((f) => f.getAttribute("action")!))) expect(action).not.toContain("#");
  await summary.getByRole("link").first().click();
  await expect(page.locator("#ib-note")).toBeFocused();

  // (3) A valid one: back on the page with the confirmation and the withdraw button; the Hub lists it as waiting.
  await page.locator("#ib-note").fill("I built a booking app for salons.");
  await Promise.all([page.waitForURL((u) => u.pathname === path && u.hash === ""), page.getByRole("button", { name: "I'm interested" }).click()]);
  const sent = page.locator("main section[aria-label='Next steps']");
  await expect(sent).toContainText("You told us you're interested");
  await expect(sent).toContainText("Interest sent — waiting for our team");
  await expect(sent.getByRole("button", { name: "Withdraw my interest" })).toBeVisible();
  await expect(page.locator("#ib-note")).toHaveCount(0);
  await scanA11y(page, { page: "/requests/:publicId (interest sent)", locale: "en" });

  await page.goto("/hub/invitations");
  const section = page.locator("#interests");
  await expect(section.getByRole("heading", { level: 2, name: "Requests you're interested in" })).toBeVisible();
  const row = section.locator("tr", { hasText: title });
  await expect(row).toContainText("Interest sent — waiting for our team");
  await expect(row.getByRole("link", { name: title })).toHaveAttribute("href", path);
  await scanA11y(page, { page: "/hub/invitations (with an interest)", locale: "en" });

  // (5) No request id, client or original wording in the page HTML (the builder's view of the listing).
  await page.goto(path);
  const html = await page.content();
  for (const secret of [id("R", attempt), CLIENT.name, CLIENT.email, "Sample request", "E2E private original"]) expect(html, secret).not.toContain(secret);

  // (4) Withdraw: the status changes and the row leaves the Hub (a withdrawn interest is not listed).
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === `${path}/interest/withdraw`),
    page.getByRole("button", { name: "Withdraw my interest" }).click(),
  ]);
  await expect(page.locator("main section[aria-label='Next steps']")).toContainText("You withdrew your interest in this request.");
  await page.goto("/hub/invitations");
  await expect(page.locator("#interests tr", { hasText: title })).toHaveCount(0);
});
