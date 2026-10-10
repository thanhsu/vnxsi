// EPIC 27 forms, `/request` part (VNX-2703a): the optional country and the per-request opt-in box. The server has a past
// REQUEST_BOARD_GO_LIVE and the flag is on in the seed (e2e/scripts/serve.mjs, seed/build-seed.mjs), so the gate is open.
// POST budget: only invalid forms are sent, rejected before any rate limit counts them. A valid one is covered by Vitest.
import type { Page } from "@playwright/test";
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
  await expect(country).toHaveValue("");
  const publish = page.locator("input[name=publish]");
  await expect(publish).toHaveCount(1);
  await expect(publish).not.toBeChecked();
  await expect(page.getByText("Show this request on the public request board")).toBeVisible();
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
