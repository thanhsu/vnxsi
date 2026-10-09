// Production smoke (VNX-0805): read-only GET/HEAD checks against a deployed origin. See docs/runbooks/deploy.md.
// Usage: npm run smoke -- [--base <url>] [--slug <product-slug>]   (default https://vnx.si; BASE_URL env also read)
import { run } from "./smoke-checks.mjs";

const code = await run({
  argv: process.argv.slice(2),
  env: { BASE_URL: process.env.BASE_URL },
  fetch: globalThis.fetch,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: Date.now,
  log: console.log,
});
process.exit(code);
