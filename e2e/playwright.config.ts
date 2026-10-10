import { defineConfig } from "@playwright/test";
import { resolveTarget } from "./lib/targets.mjs";

// resolveTarget refuses any host but localhost / 127.0.0.1 (AC6): this suite never runs against production.
const { origin } = resolveTarget(process.env as Record<string, string | undefined>);
const CI = Boolean(process.env.CI);
// E2E_CHANNEL=chrome (or msedge) uses an installed browser instead of the bundled Chromium (saves the ~170 MB download).
const channel = process.env.E2E_CHANNEL || undefined;

export default defineConfig({
  testDir: "./tests",
  outputDir: "../test-results",
  globalSetup: "./global-setup.ts",
  // One server, one shared database, specs that write: a single worker. Specs must not depend on each other (own token or product each).
  workers: 1,
  fullyParallel: false,
  // Local default 0, CI 1. E2E_RETRIES overrides it: a machine that drops local TCP connections (net::ERR_ADDRESS_IN_USE, ERR_NO_BUFFER_SPACE) needs it; a healthy one does not.
  retries: Number(process.env.E2E_RETRIES ?? (CI ? 1 : 0)),
  timeout: 30_000,
  globalTimeout: 8 * 60_000,
  expect: { timeout: 5_000 },
  forbidOnly: CI,
  reporter: [["list"], ["html", { outputFolder: "../playwright-report", open: "never" }]],
  use: {
    baseURL: origin,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    ...(channel ? { channel } : {}),
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: "node e2e/scripts/serve.mjs",
    cwd: "..",
    url: `${origin}/api/health`,
    // Never reuse: the suite POSTs, and a server another session started has its own database.
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
