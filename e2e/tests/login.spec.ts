// Sign-in by e-mail link. The mailer is a fake inside the worker, so the link is not read from mail: the seed holds one-use tokens
// (e2e/seed/fixtures.mjs) and each test spends its own. The POST goes through a real browser, with a real Origin header.
// A one-use token is spent by its test, so each attempt (test.info().retry) uses its own token from the seed: a retry can really pass.
// POST /login budget: 2 here (the limits are 5 an hour per e-mail and 20 per IP).
import { TOKENS, tokenFor } from "../seed/fixtures.mjs";
import { expect, test } from "../support/test";

const SESSION = "__Host-vnx_session";

/** Opens the confirmation page of a seeded token and presses its button; returns the POST request the browser sent. */
async function signInWith(page: import("@playwright/test").Page, token: string, query = "") {
  await page.goto(`/auth/verify?t=${token}${query}`);
  const [request] = await Promise.all([page.waitForRequest((r) => r.method() === "POST"), page.getByRole("button", { name: "Sign in" }).click()]);
  return request;
}

const sessionCookie = async (page: import("@playwright/test").Page) => (await page.context().cookies()).find((c) => c.name === SESSION);

test("the sign-in form refuses a bad e-mail and accepts a good one", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel("Email")).toBeVisible();
  await page.locator("form[action='/login']").evaluate((f) => ((f as HTMLFormElement).noValidate = true));
  await page.getByLabel("Email").fill("not-an-email");
  const [bad] = await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), page.getByRole("button", { name: "Send sign-in link" }).click()]);
  expect(bad.status()).toBe(400);
  await expect(page.getByRole("alert")).toContainText("doesn't look right");
  await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Email")).toHaveValue("not-an-email");

  await page.getByLabel("Email").fill("ada.login@example.test");
  const [ok] = await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), page.getByRole("button", { name: "Send sign-in link" }).click()]);
  expect(ok.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
  await expect(page.getByText("ada.login@example.test")).toBeVisible();
});

test("a link opens a confirmation page, only its button signs in, and it works once", async ({ page }) => {
  const res = await page.goto(`/auth/verify?t=${tokenFor("OK_1", test.info().retry)}`);
  expect(res!.status()).toBe(200);
  expect(res!.headers()["cache-control"]).toContain("no-store");
  expect(res!.headers()["referrer-policy"]).toBe("same-origin");
  await expect(page.getByRole("heading", { name: "Finish signing in" })).toBeVisible();
  // A mail scanner that opens the link (GET) does not spend it.
  await page.reload();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  expect(await sessionCookie(page)).toBeUndefined();

  const [request] = await Promise.all([page.waitForRequest((r) => r.method() === "POST"), page.getByRole("button", { name: "Sign in" }).click()]);
  // Regression: the POST carries the page's real origin (a no-referrer policy would make it "null" and the server would answer 403).
  expect(request.headers()["origin"]).toBe(new URL(page.url()).origin);
  await expect(page).toHaveURL(/\/$/);
  const cookie = await sessionCookie(page);
  expect(cookie, "session cookie").toBeDefined();
  expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: "Lax", path: "/" });

  await page.goto("/hub");
  await expect(page).toHaveURL(/\/hub$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // The same link again: dead.
  const replay = await page.goto(`/auth/verify?t=${tokenFor("OK_1", test.info().retry)}`);
  expect(replay!.status()).toBe(400);
  await expect(page.getByRole("heading", { name: "This sign-in link no longer works" })).toBeVisible();
});

test("next sends the user to a local path", async ({ page }) => {
  await signInWith(page, tokenFor("OK_NEXT", test.info().retry), "&next=/hub/products");
  await expect(page).toHaveURL(/\/hub\/products$/);
  await expect(page.getByRole("heading", { name: "Your products" })).toBeVisible();
});

test("next never leaves the site", async ({ page, baseURL }) => {
  await signInWith(page, tokenFor("OK_NEXT_EVIL", test.info().retry), `&next=${encodeURIComponent("https://evil.example/")}`);
  await expect(page).toHaveURL(`${baseURL}/`);
  expect(new URL(page.url()).hostname).not.toBe("evil.example");
});

test("an expired link is refused and sets no cookie", async ({ page }) => {
  const res = await page.goto(`/auth/verify?t=${TOKENS.EXPIRED}`);
  expect(res!.status()).toBe(400);
  await expect(page.getByRole("heading", { name: "This sign-in link no longer works" })).toBeVisible();
  expect(await sessionCookie(page)).toBeUndefined();
});

test("signing out clears the session and closes the hub", async ({ page }) => {
  await signInWith(page, tokenFor("OK_2", test.info().retry));
  await page.goto("/hub");
  await expect(page).toHaveURL(/\/hub$/);
  await Promise.all([page.waitForURL(/\/$/), page.locator("form.signout button:visible").click()]);
  expect(await sessionCookie(page)).toBeUndefined();
  await page.goto("/hub");
  await expect(page).toHaveURL(/\/login\?next=%2Fhub$/);
});

test("the hub redirects a signed-out visitor to sign in, keeping where they were going", async ({ request }) => {
  for (const path of ["/hub", "/hub/products"]) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.status(), path).toBe(303);
    expect(res.headers()["location"], path).toBe(`/login?next=${encodeURIComponent(path)}`);
  }
});
