// EPIC 27 (VNX-2706b): the "Interested builders" block on the Ops request page, as the staff user (opsPage: a seeded cookie, no /login).
// One seeded pending interest per attempt (R 3 + retry, interest I 3 + retry, from the other builder). POST budget: Dismiss has no rate limit and is sent once per attempt;
// the interest rows are seeded, so none of the 10-a-day interest budget of the main builder (request-board-interest.spec.ts, at most 3) is used. Invite is covered by Vitest
// (it moves a request to matching, which the other specs' counts should not see).
import { id, OTHER } from "../seed/fixtures.mjs";
import { expect, test } from "../support/test";

test.use({ reducedMotion: "reduce" });

test("Ops sees a builder's interest on the request page and dismisses it", async ({ opsPage: page }) => {
  const attempt = 3 + test.info().retry;
  const path = `/ops/marketplace/requests/${id("R", attempt)}`;
  await page.goto(path);

  const block = page.locator("#ib-block");
  await expect(block.getByRole("heading", { level: 2, name: "Interested builders" })).toBeVisible();
  const row = block.locator("tr", { hasText: OTHER.name });
  await expect(row).toContainText(`@${OTHER.handle}`);
  await expect(row).toContainText(`E2E interest note ${attempt}: I can build this.`);
  await expect(row).toContainText("Waiting");
  await expect(row.getByRole("button", { name: `Invite ${OTHER.name}` })).toBeVisible();
  for (const action of await block.locator("form").evaluateAll((forms) => forms.map((f) => f.getAttribute("action")!))) expect(action).not.toContain("#");

  await Promise.all([page.waitForURL((u) => u.pathname === path && u.search === "?done=1"), row.getByRole("button", { name: `Dismiss the interest of ${OTHER.name}` }).click()]);
  const after = page.locator("#ib-block").locator("tr", { hasText: OTHER.name });
  await expect(after).toContainText("Dismissed");
  await expect(after.getByRole("button")).toHaveCount(0);
  await expect(page.locator("[role=alert]")).toHaveCount(0);
});
