// axe-core, WCAG 2.2 AA, on every public page and the signed-in builder pages (docs/blueprint/02-NFR.md, Accessibility).
// A violation fails the test unless e2e/support/a11y-known.ts defers it with a finding; a deferral that no longer matches fails too.
import { DRAFT_PRODUCT, MAIN, PUBLISHED_PRODUCT, TOKENS } from "../seed/fixtures.mjs";
import { scanA11y } from "../support/a11y";
import { formatEn } from "../support/page";
import { expect, test } from "../support/test";

type Entry = { path: string; url?: string };

const PUBLIC_EN: Entry[] = [
  { path: "/" },
  { path: "/products" },
  { path: "/builders" },
  { path: `/b/${MAIN.handle}` },
  { path: `/b/${MAIN.handle}/hire` },
  { path: `/p/${PUBLISHED_PRODUCT.slug}` },
  { path: "/request" },
  { path: "/for-builders" },
  { path: "/privacy" },
  { path: "/contact" },
  { path: "/login" },
  // GET only: the confirmation page does not spend the token.
  { path: "/auth/verify", url: `/auth/verify?t=${TOKENS.OK_A11Y}` },
];

const SIGNED_IN: Entry[] = [{ path: "/hub" }, { path: "/hub/products" }, { path: `/hub/products/${DRAFT_PRODUCT.id}/edit/product` }];

const PUBLIC_VI: Entry[] = [{ path: "/vi/" }, { path: "/vi/login" }, { path: `/vi/b/${MAIN.handle}/hire` }, { path: "/vi/privacy" }];

// Motion is off for the scans (colors measured in the middle of a fade or count-up would be false findings); the homepage is scanned with motion too, below.
test.describe("axe, motion reduced", () => {
  test.use({ reducedMotion: "reduce" });

  for (const entry of PUBLIC_EN) {
    test(`en ${entry.path}`, async ({ page }) => {
      const res = await page.goto(entry.url ?? entry.path);
      expect(res!.status(), "the page exists").toBeLessThan(400);
      await scanA11y(page, { page: entry.path, locale: "en" });
    });
  }

  for (const entry of SIGNED_IN) {
    test(`en ${entry.path.replace(DRAFT_PRODUCT.id, ":id")} (signed in)`, async ({ builderPage: page }) => {
      const res = await page.goto(entry.url ?? entry.path);
      expect(res!.status(), "the page exists").toBeLessThan(400);
      await scanA11y(page, { page: entry.path.replace(DRAFT_PRODUCT.id, ":id"), locale: "en" });
    });
  }

  for (const entry of PUBLIC_VI) {
    test(`vi ${entry.path}`, async ({ page }) => {
      const res = await page.goto(entry.url ?? entry.path);
      expect(res!.status(), "the page exists").toBeLessThan(400);
      expect(await page.locator("html").getAttribute("lang")).toBe("vi");
      await scanA11y(page, { page: entry.path.replace(/^\/vi/, "") || "/", locale: "vi" });
    });
  }

  // Responsive down to 360 px (spec): the homepage and the form that most people fill in.
  test.describe("360 px wide", () => {
    test.use({ viewport: { width: 360, height: 740 } });
    for (const path of ["/", `/b/${MAIN.handle}/hire`]) {
      test(`en ${path}`, async ({ page }) => {
        await page.goto(path);
        await scanA11y(page, { page: path, locale: "en", variant: "mobile" });
      });
    }
  });
});

test("en / with motion, after the numbers finished counting", async ({ page }) => {
  await page.goto("/");
  const counts = page.locator("[data-count]");
  for (let i = 0; i < (await counts.count()); i++) {
    await counts.nth(i).scrollIntoViewIfNeeded();
    await expect(counts.nth(i)).toHaveText(formatEn((await counts.nth(i).getAttribute("data-count"))!), { timeout: 3_000 });
  }
  await scanA11y(page, { page: "/", locale: "en", variant: "motion" });
});
