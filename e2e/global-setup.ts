import type { FullConfig } from "@playwright/test";

const BLOCKS = ["data-stat=", "chart-svg", "home-live"];

/** Runs the hourly job for real (wrangler dev --test-scheduled), then waits until the homepage shows its snapshot blocks. */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const origin = config.projects[0]!.use.baseURL!;
  const res = await fetch(`${origin}/__scheduled?cron=5+*+*+*+*`);
  if (!res.ok) throw new Error(`E2E setup: /__scheduled answered ${res.status}: the local server did not run the hourly cron`);
  // The cron runs in ctx.waitUntil, so poll until the numbers show up.
  const deadline = Date.now() + 30_000;
  let html = "";
  while (Date.now() < deadline) {
    html = await (await fetch(`${origin}/`)).text();
    if (BLOCKS.every((b) => html.includes(b))) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  const missing = BLOCKS.filter((b) => !html.includes(b));
  throw new Error(`E2E setup: homepage snapshot not ready after 30 s (missing ${missing.join(", ")}): the seed is below a threshold of apps/web/src/domain/public-stats.ts MIN`);
}
