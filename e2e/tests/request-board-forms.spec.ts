// EPIC 27 forms, `/request` part (VNX-2703a): the optional country and the per-request opt-in box. The server has a past
// REQUEST_BOARD_GO_LIVE and the flag is on in the seed (e2e/scripts/serve.mjs, seed/build-seed.mjs), so the gate is open.
// POST budget: only invalid forms are sent, rejected before any rate limit counts them. A valid one is covered by Vitest.
import type { Page } from "@playwright/test";
import { id } from "../seed/fixtures.mjs";
import { expect, test } from "../support/test";

test.use({ reducedMotion: "reduce" });

type Locale = { prefix: string; title: string; path: string; none: string };
const EN: Locale = { prefix: "Error:", title: "There is a problem", path: "", none: "Not specified" };
const VI: Locale = { prefix: "Lỗi:", title: "Có lỗi cần sửa", path: "/vi", none: "Không nêu" };

const submit = (page: Page, path: string) =>
  Promise.all([page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === path), page.getByRole("button", { name: /./ }).last().click()]).then(([res]) => res);

test("/request offers an optional country and an unchecked opt-in box with its warning", async ({ page }) => {
  await page.goto("/request");
  const country = page.locator("select[name=country]");
  await expect(country).toHaveCount(1);
  // The first option is the empty one, and nothing is preselected from the network.
  await expect(country.locator("option").first()).toHaveAttribute("value", "");
  await expect(country.locator("option").first()).toHaveText("Not specified");
  await expect(page.getByLabel("Where is your business based?")).toHaveCount(1);
  await expect(page.locator("#rq-country-hint")).toHaveText("Optional. If you choose to show this request on the public request board, the country is shown there too.");
  await expect(country).toHaveValue("");
  const publish = page.locator("input[name=publish]");
  await expect(publish).toHaveCount(1);
  await expect(publish).not.toBeChecked();
  await expect(page.getByText("Show this request on the public request board", { exact: true })).toBeVisible();
  await expect(page.locator("#rq-publish-hint")).toContainText("Your name and email are never shown.");
  await expect(page.locator("#rq-publish-hint")).toContainText("Country, budget and a very specific niche together can sometimes identify a business.");
});

for (const l of [EN, VI]) {
  test(`${l.path || "/en"} request form with the box checked and a country, but a missing title: 400 keeps both`, async ({ page }) => {
    const path = `${l.path}/request`;
    await page.goto(path);
    await page.locator("form[method=post]").evaluate((f) => ((f as HTMLFormElement).noValidate = true));
    await page.locator("#rq-name").fill("Ada Tester");
    await page.locator("#rq-email").fill("ada.client@example.test");
    await page.locator("#rq-country").selectOption("VN");
    await page.locator("#rq-publish").check();
    const res = await submit(page, path);
    expect(res.status()).toBe(400);
    // The shared error pattern (VNX-0807).
    await expect(page).toHaveTitle(new RegExp(`^${l.prefix} `));
    const summary = page.locator("#form-errors");
    await expect(summary.getByRole("heading", { level: 2 })).toHaveText(l.title);
    await expect(summary).toBeFocused();
    const links = summary.getByRole("link");
    await expect(links).toHaveCount(await page.locator("p.error-msg").count());
    for (const href of await links.evaluateAll((els) => els.map((e) => e.getAttribute("href")!))) await expect(page.locator(href), href).toHaveCount(1);
    await expect(page.locator("[role=alert]")).toHaveCount(0);
    // What was chosen is kept, and the URL has no fragment (a fragment would stop autofocus).
    await expect(page.locator("#rq-publish")).toBeChecked();
    await expect(page.locator("#rq-country")).toHaveValue("VN");
    await expect(page.locator("#rq-name")).toHaveValue("Ada Tester");
    expect(new URL(page.url()).hash).toBe("");
    expect(await page.locator("form[method=post]").getAttribute("action")).not.toContain("#");
  });
}

// Part 2, Ops "Public listing" (VNX-2704a). One seeded request per attempt (R 2008 + retry, a publication waiting for review), as the staff user.
// POST budget: the Ops actions have no rate limit, and this test sends two of them. The public page does not exist yet (VNX-2705a adds the signed-out check of the edited text to this test).
test("Ops moderates a public listing: the block, a refused Publish with the error pattern, then Publish", async ({ opsPage: page }) => {
  const attempt = 2008 + test.info().retry;
  const requestId = id("R", attempt);
  const path = `/ops/marketplace/requests/${requestId}`;
  await page.goto(path);

  const block = page.locator("#pl-block");
  await expect(block.getByRole("heading", { level: 2, name: "Public listing" })).toBeVisible();
  // The client's private original is shown to Ops, and the editable wording starts from it.
  await expect(block).toContainText(`E2E private original ${attempt}`);
  await expect(block.locator("#pl-public-title")).toHaveValue(`E2E private original ${attempt}`);
  await expect(block.locator("#pl-public-description")).not.toHaveValue("");
  await expect(block.getByRole("button", { name: "Publish" })).toBeVisible();
  await expect(block.getByText("Reject…")).toBeVisible();

  // A description that is too short: 400, the shared error pattern (VNX-0807).
  await block.locator("#pl-public-title").fill(`E2E board ${attempt}`);
  await block.locator("#pl-public-description").fill("Too short.");
  const refused = await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === `${path}/publication/publish`),
    block.getByRole("button", { name: "Publish" }).click(),
  ]).then(([res]) => res);
  expect(refused.status()).toBe(400);
  await expect(page).toHaveTitle(/^Error: /);
  const summary = page.locator("#form-errors");
  await expect(summary).toBeFocused();
  expect(new URL(page.url()).hash).toBe("");
  await expect(page.locator("[role=alert]")).toHaveCount(0);
  await expect(page.locator("#pl-public-description")).toHaveValue("Too short.");
  await expect(page.locator("#pl-public-description")).toHaveAttribute("aria-invalid", "true");
  await summary.getByRole("link").first().click();
  await expect(page.locator("#pl-public-description")).toBeFocused();
  for (const action of await page.locator("#pl-block form").evaluateAll((forms) => forms.map((f) => f.getAttribute("action")!))) expect(action).not.toContain("#");

  // A long enough description: Publish. The page comes back as "done" with the listing published.
  await page.locator("#pl-public-description").fill(`E2E board wording ${attempt}: a booking app for three small salons, reminders by SMS and a simple online calendar.`);
  await Promise.all([page.waitForURL((u) => u.pathname === path && u.search === "?done=1"), page.locator("#pl-block").getByRole("button", { name: "Publish" }).click()]);
  await expect(page.locator("#pl-block")).toContainText("Published");
  await expect(page.locator("#pl-block form[action$='/publication/edit']")).toHaveCount(1);
  await expect(page.locator("#pl-block form[action$='/publication/publish']")).toHaveCount(0);
});

// Part 3, /me "Public listing" (VNX-2703b). One seeded request per attempt (R 2005 + retry, submitted, no publication), as the seeded client (clientPage:
// the session is a seeded cookie, no /login). POST budget: opt-in and withdraw have no rate limit; this test sends two. The public page does not exist yet
// (VNX-2705a), and "withdrawn -> 404 at once" is covered by Vitest.
test("/me: the client opts in later and withdraws", async ({ clientPage: page }) => {
  const attempt = 2005 + test.info().retry;
  const path = `/me/requests/${id("R", attempt)}`;
  await page.goto(path);

  const block = page.locator("#me-board");
  await expect(block.getByRole("heading", { level: 2, name: "Public request board" })).toBeVisible();
  // The approved opt-in label and hint (addendum 12.4), the same as on /request; no country field here.
  await expect(block.getByText("Show this request on the public request board", { exact: true })).toBeVisible();
  await expect(block).toContainText("Your name and email are never shown.");
  await expect(block).toContainText("Country, budget and a very specific niche together can sometimes identify a business.");
  await expect(block.locator("select[name=country]")).toHaveCount(0);
  await expect(block.getByRole("button", { name: "Remove from board" })).toHaveCount(0);

  await Promise.all([page.waitForURL((u) => u.pathname === path && u.hash === ""), block.getByRole("button", { name: "Show this request on the public request board", exact: true }).click()]);
  await expect(page.locator("#me-board")).toContainText("Waiting for review");
  await expect(page.locator("#me-board").getByRole("button", { name: "Remove from board" })).toBeVisible();
  await expect(page.locator("#me-board").getByRole("button", { name: "Show this request on the public request board", exact: true })).toHaveCount(0);
  await expect(page.locator("#form-errors")).toHaveCount(0);

  await Promise.all([page.waitForURL((u) => u.pathname === path), page.locator("#me-board").getByRole("button", { name: "Remove from board" }).click()]);
  await expect(page.locator("#me-board")).toContainText("You removed this request from the public request board");
  await expect(page.locator("#me-board").getByRole("button", { name: "Show this request on the public request board again" })).toBeVisible();
  for (const action of await page.locator("#me-board form").evaluateAll((forms) => forms.map((f) => f.getAttribute("action")!))) expect(action).not.toContain("#");
});
