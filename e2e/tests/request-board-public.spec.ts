// EPIC 27 public request board (VNX-2705a): /requests and /requests/:publicId, signed out, GET only (no POST, so the POST budget does not move).
// Seed (seed/build-seed.mjs): Q1-Q8 published and open, newest first by n; Q2001 Closed (builder_selected, closed yesterday); Q2002 closed 31 days ago; Q2003 withdrawn;
// Q2004 rejected; Q2011 waiting for the e-mail. Playwright runs the files in name order with one worker, so request-board-forms.spec.ts (Ops publishes Q2008 + retry) runs
// BEFORE this one: a listing it published sits at the top of /requests. So nothing here asserts the first card is Q1, or anything about Q2008-Q2010: only the relative order of Q1-Q8.
import type { Page } from "@playwright/test";
import { CLIENT, id } from "../seed/fixtures.mjs";
import { expect, test } from "../support/test";

test.use({ reducedMotion: "reduce" });

const Q = (n: number) => id("Q", n);
const OPEN = [1, 2, 3, 4, 5, 6, 7, 8];
const HIDDEN = [2002, 2003, 2004, 2011];
/** Request ids (R) that must never appear on a public page. */
const requestIds = [...OPEN, 2001, ...HIDDEN, 2005].map((n) => id("R", n));

async function cardHrefs(page: Page): Promise<string[]> {
  return page.locator("main ul.cards h2 a").evaluateAll((els) => els.map((e) => e.getAttribute("href")!));
}

test("/requests lists Q1-Q8 in publication order and none of the closed or hidden ones", async ({ page }) => {
  const res = await page.goto("/requests");
  expect(res!.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Public request board" })).toBeVisible();
  const hrefs = await cardHrefs(page);
  // Relative order of Q1-Q8 only (see the note at the top).
  const wanted = OPEN.map((n) => `/requests/${Q(n)}`);
  expect(hrefs.filter((h) => wanted.includes(h))).toEqual(wanted);
  for (const n of OPEN) await expect(page.locator(`main a[href="/requests/${Q(n)}"]`)).toHaveText(`E2E board request ${n}`);
  for (const n of [2001, ...HIDDEN]) expect(hrefs, `Q${n}`).not.toContain(`/requests/${Q(n)}`);
  const html = await page.content();
  for (const secret of [CLIENT.name, CLIENT.email, "E2E private original", "E2E review note", ...requestIds]) expect(html, secret).not.toContain(secret);
});

// The filter is a plain GET form: with scripts off it still works (the page has none of its own).
test.describe("filter without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("choosing a category and applying gives ?category=..., only that category's cards, and an unknown parameter is ignored", async ({ page }) => {
    await page.goto("/requests");
    await page.locator("#f-category").selectOption("crm");
    await Promise.all([page.waitForURL((u) => u.pathname === "/requests" && u.searchParams.get("category") === "crm"), page.getByRole("button", { name: "Apply" }).click()]);
    const hrefs = await cardHrefs(page);
    // Q5-Q8 are the crm requests of the seed, Q1-Q4 are booking.
    for (const n of [5, 6, 7, 8]) expect(hrefs).toContain(`/requests/${Q(n)}`);
    for (const n of [1, 2, 3, 4]) expect(hrefs).not.toContain(`/requests/${Q(n)}`);
    await expect(page.locator("#f-category")).toHaveValue("crm");

    const res = await page.goto("/requests?sort=paid");
    expect(res!.status()).toBe(200);
    const all = await cardHrefs(page);
    for (const n of OPEN) expect(all).toContain(`/requests/${Q(n)}`);
    // No sort control exists to be sent.
    await expect(page.locator("main [name=sort]")).toHaveCount(0);
  });
});

test("an open listing: title, Open, the public wording, the sign-in CTA with next, and nothing private", async ({ page }) => {
  const res = await page.goto(`/requests/${Q(1)}`);
  expect(res!.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "E2E board request 1" })).toBeVisible();
  await expect(page.locator("main .badge")).toHaveText("Open");
  await expect(page.locator("main")).toContainText("E2E board public description 1");
  await expect(page.locator("main")).toContainText("The client's identity is not shown. The VNX.SI team invites up to five builders.");
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await expect(page.getByRole("link", { name: "I'm a builder — I'm interested" })).toHaveAttribute("href", `/login?next=%2Frequests%2F${Q(1)}`);
  const html = await page.content();
  for (const secret of [CLIENT.name, CLIENT.email, "E2E private original", "Sample request 1", ...requestIds]) expect(html, secret).not.toContain(secret);
});

test("a closed listing is 200 with Closed, only the closed sentence and Post a request, and noindex", async ({ page }) => {
  const res = await page.goto(`/requests/${Q(2001)}`);
  expect(res!.status()).toBe(200);
  await expect(page.locator("main .badge")).toHaveText("Closed");
  await expect(page.locator("main")).toContainText("This request is closed");
  await expect(page.locator("main").getByRole("link", { name: "Post a request" })).toHaveAttribute("href", "/request");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
  await expect(page.getByRole("link", { name: "I'm a builder — I'm interested" })).toHaveCount(0);
  // How it ended is not shown.
  expect(await page.locator("main").innerText()).not.toMatch(/selected|expired/i);
});

test("closed over 30 days ago, withdrawn, rejected, waiting for the e-mail, a made-up id and a request id are 404 with nothing of them on the page", async ({ page }) => {
  const paths = [...HIDDEN.map((n) => `/requests/${Q(n)}`), "/requests/NOT-A-LISTING", `/requests/${id("R", 2001)}`, `/requests/${id("R", 1)}`];
  for (const path of paths) {
    const res = await page.goto(path);
    expect(res!.status(), path).toBe(404);
    const html = await page.content();
    for (const secret of ["E2E board", "E2E review note", "E2E private original", CLIENT.name]) expect(html, `${path} ${secret}`).not.toContain(secret);
  }
  const res = await page.goto("/vi/requests/NOT-A-LISTING");
  expect(res!.status()).toBe(404);
  expect(await page.locator("html").getAttribute("lang")).toBe("vi");
});

test("/vi/requests and /vi/requests/<id>: the interface is Vietnamese, the request's own wording is not translated", async ({ page }) => {
  await page.goto("/vi/requests");
  expect(await page.locator("html").getAttribute("lang")).toBe("vi");
  await expect(page.getByRole("heading", { level: 1, name: "Bảng nhu cầu công khai" })).toBeVisible();
  await expect(page.locator(`main a[href="/vi/requests/${Q(1)}"]`)).toHaveText("E2E board request 1");
  await page.goto(`/vi/requests/${Q(1)}`);
  await expect(page.getByRole("heading", { level: 1, name: "E2E board request 1" })).toBeVisible();
  await expect(page.locator("main .badge")).toHaveText("Đang mở");
  await expect(page.getByRole("link", { name: "Tôi là builder — tôi quan tâm" })).toHaveAttribute("href", `/vi/login?next=%2Fvi%2Frequests%2F${Q(1)}`);
  await expect(page.locator("main")).toContainText("E2E board public description 1");
});
