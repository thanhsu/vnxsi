import assert from "node:assert/strict";
import http from "node:http";
import { test } from "node:test";
import { buildBudgetPlan, buildChecks, evaluate, extractLastUpdated, isRateCovered, parseArgs, run, UsageError, WINDOW_MAX, WINDOW_MS } from "../smoke-checks.mjs";

const CTX = { base: "https://vnx.si", isProd: true };
const CSP = "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; frame-ancestors 'none'";
const byId = (checks, id) => checks.find((c) => c.id === id);
const res = (status, headers = {}, body = "") => ({ status, headers: new Headers(headers), body });

// A model of the app that answers every check in the real table correctly.
function goodResponse(path) {
  const prefix = (path.match(/^\/(vi|zh-hans|zh-hant)(?=\/|$)/) ?? [""])[0];
  const rest = path.slice(prefix.length) || "/";
  const sec = { "content-security-policy": CSP, "x-content-type-options": "nosniff", "x-frame-options": "DENY", "strict-transport-security": "max-age=31536000", "referrer-policy": "strict-origin-when-cross-origin" };
  const html = { ...sec, "content-type": "text/html; charset=UTF-8" };
  const notFound = '<html><meta name="robots" content="noindex"/></html>';
  const sealed = { ...html, "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" };
  if (/^\/(admin|hub|me)$/.test(rest)) return res(303, { ...sec, location: `${prefix}/login?next=${encodeURIComponent(path)}` });
  if (rest === "/ops" || rest.startsWith("/ops/")) return prefix ? res(404, html, notFound) : res(404, sealed, notFound);
  if (rest.startsWith("/p/zz-")) return res(404, html, notFound);
  if (rest.startsWith("/go/zz-") || rest.startsWith("/go/p/zz-")) return res(404, sealed, notFound);
  if (path === "/robots.txt") return res(200, { ...sec, "content-type": "text/plain" }, "User-agent: *\nAllow: /media/products/\nDisallow: /go/\nDisallow: /ops\nDisallow: /hub\nDisallow: /vi/hub\n\nSitemap: https://vnx.si/sitemap.xml\n");
  if (path === "/sitemap.xml") return res(200, { ...sec, "content-type": "application/xml; charset=utf-8" }, "<urlset><url><loc>https://vnx.si/privacy</loc></url><url><loc>https://vnx.si/for-builders</loc></url><url><loc>https://vnx.si/media-kit</loc></url></urlset>");
  if (path === "/api/health") return res(200, { ...sec, "content-type": "application/json" }, '{"ok":true}');
  if (path === "/auth/verify") return res(400, { ...html, "referrer-policy": "same-origin", "cache-control": "no-store" }, "x");
  if (path === "/vi/zz-smoke-404") return res(404, html, notFound);
  if (rest === "/privacy") return res(200, html, "<p>Last updated: 2026-10-21</p>");
  return res(200, html, "ok");
}

// Fake clock: sleep advances time, fetch records when it was called.
function world(responder = goodResponse) {
  let t = 1_000_000;
  const calls = [];
  return {
    calls,
    now: () => t,
    sleep: async (ms) => {
      t += ms;
    },
    fetch: async (url, init) => {
      const u = new URL(url);
      calls.push({ at: t, method: init.method, path: u.pathname + u.search, redirect: init.redirect, headers: init.headers });
      const r = responder(u.pathname);
      return { status: r.status, headers: r.headers, text: async () => r.body };
    },
  };
}
async function runWith(w, argv = [], extra = {}) {
  const lines = [];
  const code = await run({ argv, env: {}, fetch: w.fetch, sleep: w.sleep, now: w.now, log: (l) => lines.push(l), ...extra });
  return { code, lines };
}

function assertWindow(times) {
  for (const start of times) assert.ok(times.filter((t) => t >= start && t < start + WINDOW_MS).length <= WINDOW_MAX, "more than 10 covered requests in a 10 s window");
}

test("evaluate: CSP with unsafe-inline fails", () => {
  const check = byId(buildChecks(), "headers /");
  const bad = goodResponse("/");
  bad.headers.set("content-security-policy", CSP + "; style-src 'unsafe-inline'");
  assert.deepEqual(evaluate(check, goodResponse("/"), CTX), []);
  assert.ok(evaluate(check, bad, CTX).some((m) => m.includes("unsafe-inline")));
});

test("evaluate: /ops without no-store fails; 303 with the wrong Location fails", () => {
  const checks = buildChecks();
  const ops = goodResponse("/ops");
  ops.headers.delete("cache-control");
  assert.ok(evaluate(byId(checks, "ops-sealed /ops"), ops, CTX).some((m) => m.includes("no-store")));
  const redirect = byId(checks, "login-redirect /vi/hub");
  assert.deepEqual(evaluate(redirect, goodResponse("/vi/hub"), CTX), []);
  assert.ok(evaluate(redirect, res(303, { location: "/login?next=%2Fvi%2Fhub" }), CTX).length > 0);
});

test("evaluate: HSTS is asserted on production only", () => {
  const check = byId(buildChecks(), "headers /");
  const r = goodResponse("/");
  r.headers.delete("strict-transport-security");
  assert.ok(evaluate(check, r, CTX).length > 0);
  assert.deepEqual(evaluate(check, r, { base: "http://localhost:8787", isProd: false }), []);
});

test("every check is GET or HEAD", () => {
  for (const c of buildChecks({ slug: "some-product" })) assert.ok(c.method === "GET" || c.method === "HEAD", `${c.id}: ${c.method}`);
});

test("the table passes against a correct app and sends only safe requests (exit 0)", async () => {
  const w = world();
  const { code, lines } = await runWith(w);
  assert.equal(code, 0, lines.join("\n"));
  assert.ok(lines.some((l) => /, 0 fail$/.test(l)));
  assert.ok(lines.some((l) => l === "Privacy: Last updated 2026-10-21"));
  for (const c of w.calls) {
    assert.ok(c.method === "GET" || c.method === "HEAD");
    assert.equal(c.redirect, "manual");
    assert.deepEqual(Object.keys(c.headers), ["user-agent"]);
    assert.equal(c.headers["user-agent"], "vnxsi-smoke/1");
  }
});

test("retries once then PASS (retry); no third request", async () => {
  let seen = 0;
  const w = world((path) => {
    if (path !== "/api/health") return goodResponse(path);
    seen++;
    return seen === 1 ? res(404) : goodResponse(path);
  });
  const { code, lines } = await runWith(w);
  assert.equal(code, 0);
  assert.equal(seen, 2);
  assert.ok(lines.some((l) => l.startsWith("PASS (retry)") && l.includes("api/health")));
  assert.ok(lines.some((l) => /1 pass-after-retry, 0 fail/.test(l)));
});

test("a persistent failure is FAIL after exactly two requests (exit 1)", async () => {
  const w = world((path) => (path === "/api/health" ? res(500) : goodResponse(path)));
  const { code, lines } = await runWith(w);
  assert.equal(code, 1);
  assert.equal(w.calls.filter((c) => c.path === "/api/health").length, 2);
  assert.ok(lines.some((l) => l.startsWith("FAIL") && l.includes("api/health")));
});

test("a network error is retried once like any failure", async () => {
  const w = world();
  const inner = w.fetch;
  let n = 0;
  w.fetch = async (url, init) => {
    if (new URL(url).pathname === "/api/health" && n++ === 0) throw new Error("boom");
    return inner(url, init);
  };
  const { code, lines } = await runWith(w);
  assert.equal(code, 0);
  assert.ok(lines.some((l) => l.startsWith("PASS (retry)")));
});

test("429 waits and retries once with a warning instead of failing at once", async () => {
  let first = true;
  const w = world((path) => {
    if (path.startsWith("/p/zz-") && first) {
      first = false;
      return res(429);
    }
    return goodResponse(path);
  });
  const { code, lines } = await runWith(w);
  assert.equal(code, 0);
  assert.ok(lines.some((l) => l.includes("rate limited")));
});

test("rate-limited paths <= 8 in the real table, window <= 10 on the clock", async () => {
  assert.ok(buildBudgetPlan(buildChecks({ slug: "x" })).covered <= 8);
  assert.ok(buildBudgetPlan(buildChecks()).covered <= 8);
  assert.equal(isRateCovered("/vi/p/a"), true);
  assert.equal(isRateCovered("/go/a"), true);
  assert.equal(isRateCovered("/products"), false);
  const w = world();
  await runWith(w, ["--slug", "some-product"]);
  assertWindow(w.calls.filter((c) => isRateCovered(c.path)).map((c) => c.at));
});

test("the limiter holds for a table far above the real budget (30 covered checks)", async () => {
  const checks = Array.from({ length: 30 }, (_, i) => ({ id: `c${i}`, path: `/p/zz-${i}`, method: "GET", status: 404, asserts: [], covered: true }));
  const w = world(() => res(404));
  const { code } = await runWith(w, [], { checks });
  assert.equal(code, 0);
  const times = w.calls.map((c) => c.at);
  assert.equal(times.length, 30);
  assertWindow(times);
  for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= 600);
});

test("parseArgs: defaults, env, trailing slash, rejects foreign schemes and bad slugs", () => {
  assert.deepEqual(parseArgs([], {}), { base: "https://vnx.si", slug: null });
  assert.equal(parseArgs([], { BASE_URL: "https://example.test/" }).base, "https://example.test");
  assert.equal(parseArgs(["--base", "http://localhost:8787"], { BASE_URL: "https://x.test" }).base, "http://localhost:8787");
  assert.equal(parseArgs(["--base", "http://127.0.0.1:8787/"], {}).base, "http://127.0.0.1:8787");
  for (const bad of ["ftp://x", "http://example.com", "not a url", "https://vnx.si/path"]) assert.throws(() => parseArgs(["--base", bad], {}), UsageError, bad);
  assert.throws(() => parseArgs(["--slug", "Bad Slug"], {}), UsageError);
  assert.throws(() => parseArgs(["--nope"], {}), UsageError);
});

test("bad arguments: exit 2 and no request sent", async () => {
  const w = world();
  const { code } = await runWith(w, ["--base", "ftp://x"]);
  assert.equal(code, 2);
  assert.equal(w.calls.length, 0);
});

test("extractLastUpdated", () => {
  assert.equal(extractLastUpdated("<p>Last updated: 2026-10-21</p>"), "2026-10-21");
  assert.equal(extractLastUpdated("nothing"), null);
});

test("--slug adds HEAD-only checks for the product page and the /go redirect", () => {
  const extra = buildChecks({ slug: "demo-app" }).filter((c) => c.path.includes("demo-app"));
  assert.equal(extra.length, 2);
  for (const c of extra) assert.equal(c.method, "HEAD");
  const redirect = extra.find((c) => c.status === 302);
  const ok = res(302, { location: "https://demo.example/x", "referrer-policy": "origin", "x-robots-tag": "noindex, nofollow" });
  assert.deepEqual(evaluate(redirect, ok, CTX), []);
  ok.headers.set("location", "javascript:alert(1)");
  assert.ok(evaluate(redirect, ok, CTX).length > 0);
});

test("against a real local HTTP server: 500s give exit 1, correct answers give exit 0", async () => {
  for (const [mode, want] of [
    ["bad", 1],
    ["good", 0],
  ]) {
    const server = http.createServer((req, rsp) => {
      if (mode === "bad") {
        rsp.statusCode = 500;
        rsp.end("nope");
        return;
      }
      const r = goodResponse(new URL(req.url, "http://x").pathname);
      rsp.statusCode = r.status;
      for (const [k, v] of r.headers) rsp.setHeader(k, v);
      rsp.end(req.method === "HEAD" ? undefined : r.body);
    });
    await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
      // Real fetch, instant sleep: only the pacing delays are skipped, never the requests.
      let t = 0;
      const lines = [];
      const code = await run({ argv: ["--base", base], env: {}, fetch: globalThis.fetch, sleep: async (ms) => { t += ms; }, now: () => t, log: (l) => lines.push(l) });
      assert.equal(code, want, lines.join("\n"));
    } finally {
      server.close();
    }
  }
});
