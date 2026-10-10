import type { Page } from "@playwright/test";

/** The fake driver (TURNSTILE_DRIVER=fake) accepts this token. */
export const FAKE_TURNSTILE_PASS = "test-pass";

/**
 * The Cloudflare script is blocked in every test, so the widget never fills its response field: add it the way the widget does,
 * as a hidden input named cf-turnstile-response in the form.
 */
export async function fillFakeTurnstile(page: Page, token: string = FAKE_TURNSTILE_PASS): Promise<void> {
  await page.locator("form .cf-turnstile").evaluate((widget, value) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "cf-turnstile-response";
    input.value = value;
    widget.parentElement!.appendChild(input);
  }, token);
}
