import { expect, test as base, type Page } from "@playwright/test";
import { SESSION_RAW } from "../seed/fixtures.mjs";
import { watchCsp, type CspWatch } from "./csp";
import { watchSameOriginFailures } from "./network";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

/** The test API every spec uses (meta.spec.ts uses the plain Playwright one on purpose). */
export const test = base.extend<{ csp: CspWatch; builderPage: Page }>({
  // No network beyond the local server: tests do not depend on the internet and never reach Cloudflare.
  context: async ({ context }, use) => {
    await context.route((url) => !LOCAL_HOSTS.has(url.hostname), (route) => route.abort());
    await use(context);
  },
  // Same-origin request failures are recorded, so a scan never runs on a half-loaded page (R2(a) of VNX-0807).
  page: async ({ page, baseURL }, use) => {
    watchSameOriginFailures(page, baseURL!);
    await use(page);
  },
  // Every test ends with: no CSP violation, no console.error, no uncaught page error.
  csp: [
    async ({ page }, use) => {
      const watch = await watchCsp(page);
      await use(watch);
      expect(watch.violations, "CSP violations").toEqual([]);
      expect(watch.errors, "console errors / page errors").toEqual([]);
    },
    { auto: true },
  ],
  // A page whose context holds the seeded session cookie of the main builder (no mail, no login round trip).
  builderPage: async ({ context, page, baseURL }, use) => {
    // Domain + path, not url: the CDP rejects a __Host- cookie given by an http:// url, and takes it by host (checked in the VNX-0802 report). No HTTPS needed.
    await context.addCookies([{ name: "__Host-vnx_session", value: SESSION_RAW, domain: new URL(baseURL!).hostname, path: "/", httpOnly: true, secure: true, sameSite: "Lax" }]);
    await use(page);
  },
});

export { expect };
