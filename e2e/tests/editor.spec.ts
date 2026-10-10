// Product editor of a signed-in builder (seeded session). Every test that writes makes its own product, so order does not matter.
import { DRAFT_PRODUCT, OTHER_PRODUCT, PUBLISHED_PRODUCT } from "../seed/fixtures.mjs";
import { expect, test } from "../support/test";

const EDIT = /\/hub\/products\/[0-9A-HJKMNP-TV-Z]{26}\/edit\/product$/;

test("the product list shows the seeded drafts and products", async ({ builderPage: page }) => {
  await page.goto("/hub/products");
  await expect(page.getByRole("heading", { name: "Your products", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: DRAFT_PRODUCT.name })).toBeVisible();
  await expect(page.getByRole("link", { name: PUBLISHED_PRODUCT.name })).toBeVisible();
  await expect(page.getByRole("link", { name: OTHER_PRODUCT.name }), "another builder's product").toHaveCount(0);
});

test("create a draft, fill every step, and see only the image gap left", async ({ builderPage: page }) => {
  // The name carries the attempt number: a retry must not meet the slug the first attempt already took (the app would add a random suffix).
  const retry = test.info().retry;
  const name = retry === 0 ? "E2E Created Product" : `E2E Created Product ${retry}`;
  const slug = retry === 0 ? "e2e-created-product" : `e2e-created-product-${retry}`;
  await page.goto("/hub/products");
  await page.getByLabel("Product name").fill(name);
  await page.getByRole("button", { name: "Create a draft" }).click();
  await expect(page).toHaveURL(EDIT);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(name);
  await expect(page.getByLabel("Page address")).toHaveValue(slug);
  const gaps = page.locator(".product-actions li");
  await expect(gaps.filter({ hasText: "Add a tagline" })).toHaveCount(1);
  const editUrl = page.url();
  const stepUrl = (step: string) => editUrl.replace(/\/edit\/product$/, `/edit/${step}`);

  /** Saves the form of the current step: the page comes back with "Saved." */
  const save = async () => {
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
  };

  await test.step("product", async () => {
    await page.getByLabel("Tagline").fill("Bookings for small studios");
    await page.getByLabel("Category").selectOption("booking");
    await page.getByLabel("How you deliver it").selectOption("saas");
    await page.getByLabel("Tags").fill("booking, calendar");
    await page.getByLabel("Description").fill("A sample product written by the E2E suite.");
    await save();
    await page.goto(stepUrl("product"));
    await expect(page.getByLabel("Tagline")).toHaveValue("Bookings for small studios");
    await expect(page.getByLabel("Category")).toHaveValue("booking");
    await expect(page.getByLabel("Tags")).toHaveValue("booking, calendar");
  });
  await test.step("problem", async () => {
    await page.goto(stepUrl("problem"));
    await page.getByLabel("What problem does it solve?").fill("Studios lose bookings to missed calls.");
    await save();
    await page.goto(stepUrl("problem"));
    await expect(page.getByLabel("What problem does it solve?")).toHaveValue("Studios lose bookings to missed calls.");
  });
  await test.step("audience", async () => {
    await page.goto(stepUrl("audience"));
    await page.getByLabel("Who is it for?").fill("Yoga and dance studios.");
    await save();
  });
  await test.step("features", async () => {
    await page.goto(stepUrl("features"));
    await page.getByLabel("Features").fill("Online calendar\nEmail reminders");
    await page.getByLabel("Tech stack").fill("TypeScript, D1");
    await save();
    await page.goto(stepUrl("features"));
    await expect(page.getByLabel("Features")).toHaveValue("Online calendar\nEmail reminders");
  });
  await test.step("demo", async () => {
    await page.goto(stepUrl("demo"));
    await page.getByLabel("Demo link").fill("https://demo.example.com/studio");
    await save();
    await page.goto(stepUrl("demo"));
    await expect(page.getByLabel("Demo link")).toHaveValue("https://demo.example.com/studio");
  });
  await test.step("customization", async () => {
    await page.goto(stepUrl("customization"));
    await page.getByLabel("I can customize this product for a client").check();
    await page.getByLabel("What can be customized").fill("Branding and opening hours.");
    await save();
    await page.goto(stepUrl("customization"));
    await expect(page.getByLabel("I can customize this product for a client")).toBeChecked();
  });
  await test.step("license (only for source code)", async () => {
    await page.goto(stepUrl("license"));
    await expect(page.getByText("A license is only needed for products sold as source code.")).toBeVisible();
  });
  await test.step("support", async () => {
    await page.goto(stepUrl("support"));
    await page.getByLabel("Support you offer").fill("Email support on weekdays.");
    await save();
  });
  await test.step("pricing", async () => {
    await page.goto(stepUrl("pricing"));
    await page.locator("input[name='tiers[0].name']").fill("Starter");
    await page.locator("input[name='tiers[0].price']").fill("49");
    await save();
    await page.goto(stepUrl("pricing"));
    await expect(page.locator("input[name='tiers[0].price']")).toHaveValue("49");
  });

  // Everything the form can fill is filled: the only thing left is the image upload (covered later, with R2).
  await page.goto(stepUrl("product"));
  await expect(gaps).toHaveText(["Upload at least one image"]);
  await expect(page.getByText("Ready to submit for review.")).toHaveCount(0);
});

test("invalid input is refused per field and keeps what was typed", async ({ builderPage: page }) => {
  const url = `/hub/products/${DRAFT_PRODUCT.id}/edit`;
  const save = (path: string) => Promise.all([page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === path), page.getByRole("button", { name: "Save" }).click()]);

  await page.goto(`${url}/product`);
  await page.getByLabel("Page address").fill("Bad Slug!");
  const [badSlug] = await save(`${url}/product`);
  expect(badSlug.status()).toBe(400);
  await expect(page.getByLabel("Page address")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#pf-slug-error")).toContainText("lowercase letters");
  await expect(page.getByLabel("Page address")).toHaveValue("Bad Slug!");
  await expect(page.getByRole("alert")).toContainText("Please fix the highlighted fields.");

  await page.getByLabel("Page address").fill(PUBLISHED_PRODUCT.slug);
  const [taken] = await save(`${url}/product`);
  expect(taken.status()).toBe(409);
  await expect(page.locator("#pf-slug-error")).toContainText("already taken");

  // A URL the browser accepts but the server refuses (not https).
  await page.goto(`${url}/demo`);
  await page.getByLabel("Demo link").fill("http://example.com/demo");
  const [demo] = await save(`${url}/demo`);
  expect(demo.status()).toBe(400);
  await expect(page.locator("#pf-demoUrl-error")).toContainText("https://");
  await expect(page.getByLabel("Demo link")).toHaveValue("http://example.com/demo");
});

test("a signed-out visitor is sent to sign in, and a builder cannot open another builder's product", async ({ request, builderPage: page }) => {
  const anonymous = await request.get(`/hub/products/${DRAFT_PRODUCT.id}/edit/product`, { maxRedirects: 0 });
  expect(anonymous.status()).toBe(303);
  expect(anonymous.headers()["location"]).toContain("/login?next=");

  const foreign = await page.goto(`/hub/products/${OTHER_PRODUCT.id}/edit/product`);
  expect(foreign!.status()).toBe(404);
  await expect(page.getByLabel("Tagline")).toHaveCount(0);
});
