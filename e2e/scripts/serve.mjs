// Starts the app for the E2E suite (Playwright `webServer.command`): a fresh local D1 under e2e/.state, migrated and seeded,
// then `wrangler dev` on the E2E port. Everything is local: no Cloudflare login, no remote flag, no real mail or Turnstile.
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveTarget } from "../lib/targets.mjs";
import { buildSeed } from "../seed/build-seed.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const webDir = path.join(repoRoot, "apps", "web");
const stateDir = path.join(repoRoot, "e2e", ".state");

// This program only ever talks to the local simulator. Refuse anything that could reach Cloudflare.
if (process.argv.slice(2).some((a) => a.includes("--remote"))) {
  console.error("e2e serve: refusing to run with --remote");
  process.exit(1);
}

const { port, inspectorPort, origin } = resolveTarget(process.env);

// A developer's apps/web/.dev.vars may hold a real mail key. The --var flags below override it: checked by experiment (VNX-0802 report):
// with a non-empty RESEND_API_KEY in .dev.vars the form still rendered the fake Turnstile key, which only exists while that key is empty.

const require = createRequire(path.join(webDir, "package.json"));
const wranglerBin = path.join(path.dirname(require.resolve("wrangler/package.json")), "bin", "wrangler.js");

function wrangler(args) {
  // Output is kept quiet (a D1 file run prints one JSON block per statement) and shown only on failure.
  const result = spawnSync(process.execPath, [wranglerBin, ...args], { cwd: webDir, encoding: "utf8", env: { ...process.env, WRANGLER_SEND_METRICS: "false", CI: "1" } });
  if (result.status !== 0) {
    console.error(result.stdout, result.stderr);
    console.error(`e2e serve: wrangler ${args[0]} ${args[1] ?? ""} failed (exit ${result.status})`);
    process.exit(result.status ?? 1);
  }
}

// 1. Every run starts from an empty database: no rate-limit counters and no spent tokens carry over.
if (path.basename(stateDir) !== ".state" || path.basename(path.dirname(stateDir)) !== "e2e") throw new Error(`unexpected state dir ${stateDir}`);
rmSync(stateDir, { recursive: true, force: true });
mkdirSync(stateDir, { recursive: true });

// 2. Migrations (all of apps/web/migrations), then the seed.
wrangler(["d1", "migrations", "apply", "vnxsi", "--local", "--persist-to", stateDir]);
const seedFile = path.join(stateDir, "seed.sql");
writeFileSync(seedFile, buildSeed(new Date()));
wrangler(["d1", "execute", "vnxsi", "--local", "--persist-to", stateDir, "--file", seedFile]);

// 3. The server. Plain strings only: nothing here is a secret.
const vars = {
  APP_ORIGIN: origin,
  MAIL_DRIVER: "fake",
  RESEND_API_KEY: "",
  TURNSTILE_DRIVER: "fake",
  ADMIN_EMAILS: "e2e-admin@example.test",
  PRIVACY_NOTICE_GO_LIVE: "",
  // Empty = no view counting and no visitor cookie, even if a developer's .dev.vars sets a salt.
  ANALYTICS_SALT: "",
};
const args = [
  wranglerBin, "dev",
  "--port", String(port),
  "--inspector-port", String(inspectorPort),
  "--persist-to", stateDir,
  "--test-scheduled",
  "--show-interactive-dev-session=false",
  "--log-level", "warn",
  ...Object.entries(vars).flatMap(([k, v]) => ["--var", `${k}:${v}`]),
];
const child = spawn(process.execPath, args, { cwd: webDir, stdio: "inherit", env: { ...process.env, WRANGLER_SEND_METRICS: "false", CI: "1" } });

let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  // Stopping the parent alone leaves workerd running: end the whole tree.
  if (process.platform === "win32" && child.pid) spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  else child.kill("SIGTERM");
}
process.on("SIGTERM", () => { stop(); process.exit(0); });
process.on("SIGINT", () => { stop(); process.exit(0); });
process.on("exit", stop);
child.on("exit", (code) => process.exit(stopping ? 0 : (code ?? 1)));
