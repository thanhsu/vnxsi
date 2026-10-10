import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { DEFAULT_INSPECTOR_PORT, DEFAULT_PORT, readPorts } from "../../e2e/lib/ports.mjs";
import { resolveTarget } from "../../e2e/lib/targets.mjs";

// AC6: the E2E suite never targets production. It POSTs forms and seeds its own database; production is checked by `npm run smoke`.

test("the default target is the local server on a port other than 8787 and 9229", () => {
  const t = resolveTarget({});
  assert.equal(t.origin, `http://localhost:${DEFAULT_PORT}`);
  assert.equal(t.port, 8799);
  assert.equal(t.inspectorPort, 9329);
  assert.notEqual(t.port, 8787);
  assert.notEqual(t.inspectorPort, 9229);
});

test("E2E_PORT and E2E_INSPECTOR_PORT move the target", () => {
  const t = resolveTarget({ E2E_PORT: "8811", E2E_INSPECTOR_PORT: "9411" });
  assert.deepEqual(t, { port: 8811, inspectorPort: 9411, origin: "http://localhost:8811" });
});

test("a BASE_URL on the local host and the E2E port is accepted", () => {
  assert.equal(resolveTarget({ BASE_URL: "http://localhost:8799" }).origin, "http://localhost:8799");
  assert.equal(resolveTarget({ BASE_URL: "http://127.0.0.1:8799/some/path" }).origin, "http://127.0.0.1:8799");
});

for (const base of [
  "https://vnx.si",
  "https://vnx.si:8799",
  "https://www.vnx.si",
  "http://www.vnx.si:8799",
  "https://vnxsi-web.example.workers.dev",
  "https://vnxsi-web.example.workers.dev:8799",
  "http://example.com:8799",
  "http://localhost.evil.com:8799",
  "http://evil.com:8799/localhost",
  "http://[::1]:8799",
  "http://0.0.0.0:8799",
  "http://192.168.1.10:8799",
]) {
  test(`BASE_URL ${base} is refused`, () => {
    assert.throws(() => resolveTarget({ BASE_URL: base }), /refuses to target|not the E2E port/);
  });
}

test("a BASE_URL that is not a URL, not http(s), or on another local port is refused", () => {
  assert.throws(() => resolveTarget({ BASE_URL: "not a url" }), /not a URL/);
  assert.throws(() => resolveTarget({ BASE_URL: "ftp://localhost:8799" }), /http\(s\)/);
  assert.throws(() => resolveTarget({ BASE_URL: "http://localhost:8787" }), /not the E2E port/);
  assert.throws(() => resolveTarget({ BASE_URL: "http://localhost" }), /not the E2E port/);
});

test("bad ports are refused", () => {
  assert.throws(() => readPorts({ E2E_PORT: "abc" }), /E2E_PORT/);
  assert.throws(() => readPorts({ E2E_PORT: "80" }), /between 1024 and 65535/);
  assert.throws(() => readPorts({ E2E_PORT: "70000" }), /between 1024 and 65535/);
  assert.throws(() => readPorts({ E2E_PORT: "8800", E2E_INSPECTOR_PORT: "8800" }), /must differ/);
  assert.deepEqual(readPorts({}), { port: DEFAULT_PORT, inspectorPort: DEFAULT_INSPECTOR_PORT });
});

// AC12, enforced as a test too: nothing under e2e/ waits on a clock, names production, or carries a secret.
const e2eDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "e2e");
function* sources(dir) {
  for (const name of readdirSync(dir)) {
    if (name === ".state" || name === "node_modules") continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) yield* sources(full);
    else if (/\.(ts|mjs|json)$/.test(name)) yield full;
  }
}

test("no file under e2e/ uses waitForTimeout, names production, or carries a secret", () => {
  const forbidden = [/waitForTimeout/, /https?:\/\/(www\.)?vnx\.si/, /workers\.dev/, /RESEND_API_KEY=[^ "]/, /TURNSTILE_SECRET/, /--remote/];
  const files = [...sources(e2eDir)];
  assert.ok(files.length > 10, "found the e2e sources");
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const re of forbidden) {
      if (re.source === "--remote" && path.basename(file) === "serve.mjs") continue; // the refusal itself, checked by the next test
      const hits = text.split("\n").filter((line) => re.test(line));
      assert.deepEqual(hits, [], `${path.relative(e2eDir, file)} matches ${re}`);
    }
  }
});

test("serve.mjs refuses --remote and never passes it to wrangler", () => {
  const serve = readFileSync(path.join(e2eDir, "scripts", "serve.mjs"), "utf8");
  assert.match(serve, /refusing to run with --remote/);
  assert.equal(serve.split("--remote").length - 1, 2, "--remote appears only in the refusal (check and message)");
  assert.match(serve, /"--local"/, "d1 commands run on the local database");
});
