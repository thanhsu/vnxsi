import assert from "node:assert/strict";
import http from "node:http";
import { test } from "node:test";
import { MAX_CONSECUTIVE_NETWORK_ERRORS, buildBudgetPlan, buildChecks, evaluate, extractLastUpdated, isRateCovered, parseArgs, run, UsageError, WINDOW_MAX, WINDOW_MS } from "../smoke-checks.mjs";

const CTX = { base: "https://vnx.si", isProd: true };
const CSP = "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; frame-ancestors 'none'";
const byId = (checks, id) => checks.find((c) => c.id === id);
const res = (status, headers = {}, body = "") => ({ status, headers: new Headers(headers), body });

// A model of the app that answers every check in the real table correctly.
// `board` = the request board is on (the --board mode); default off, the state after the first deploy.
function goodResponse(path, board = false) {
  const prefix = (path.match(/^\/(vi|zh-hans|zh-hant)(?=\/|$)/) ?? [""])[0];
  const rest = path.slice(prefix.length) || "/";
  const sec = { "content-security-policy": CSP, "x-content-type-options": "nosniff", "x-frame-options": "DENY", "strict-transport-security": "max-age=31536000", "referrer-policy": "strict-origin-when-cross-origin" };
  const html = { ...sec, "content-type": "text/html; charset=UTF-8" };
  const notFound = '<html><meta name="robots" content="noindex"/></html>';
  const sealed = { ...html, "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" };
  if (rest === "/requests") return board ? res(200, html, "board list") : res(404, html, notFound);
  if (rest.startsWith("/requests/zz-")) return res(404, html, notFound);
  if (/^\/(admin|hub|me)$/.test(rest)) return res(303, { ...sec, location: `${prefix}/login?next=${encodeURIComponent(path)}` });
  if (rest === "/ops" || rest.startsWith("/ops/")) return prefix ? res(404, { ...html, "cache-control": "no-store" }, notFound) : res(404, sealed, notFound);
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
function world(responder = (path) => goodResponse(path)) {
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

test("rate-limited paths per mode in the real table (EPIC 27: /requests* counts), window <= 10 on the clock", async () => {
  // 6 today (4x /p/ 404, 2x /go 404) + the board checks: off = 4x /requests + 1 missing listing, --board = /requests + 1 missing listing; --slug adds 2 HEAD checks.
  assert.equal(buildBudgetPlan(buildChecks()).covered, 11);
  assert.equal(buildBudgetPlan(buildChecks({ slug: "x" })).covered, 13);
  assert.equal(buildBudgetPlan(buildChecks({ board: true })).covered, 8);
  assert.equal(buildBudgetPlan(buildChecks({ board: true, slug: "x" })).covered, 10);
  assert.equal(isRateCovered("/requests"), true);
  assert.equal(isRateCovered("/vi/requests"), true);
  assert.equal(isRateCovered("/zh-hant/requests/ABC"), true);
  assert.equal(isRateCovered("/requestsx"), false);
  assert.equal(isRateCovered("/me/requests/ABC"), false);
  assert.equal(isRateCovered("/vi/p/a"), true);
  assert.equal(isRateCovered("/go/a"), true);
  assert.equal(isRateCovered("/products"), false);
  for (const argv of [["--slug", "some-product"], ["--slug", "some-product", "--board"], ["--board"], []]) {
    const w = world((path) => goodResponse(path, argv.includes("--board")));
    const { code, lines } = await runWith(w, argv);
    // The model of the app has no real product, so a --slug run is not expected to pass; only the pacing is asserted for it.
    if (!argv.includes("--slug")) assert.equal(code, 0, lines.join("\n"));
    assertWindow(w.calls.filter((c) => isRateCovered(c.path)).map((c) => c.at));
  }
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
  assert.deepEqual(parseArgs([], {}), { base: "https://vnx.si", slug: null, board: false });
  assert.equal(parseArgs(["--board"], {}).board, true);
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

test("/vi/ops: no-store and noindex (meta) pass; missing no-store fails", () => {
  const check = byId(buildChecks(), "ops-not-localized /vi/ops");
  const ok = res(404, { "cache-control": "no-store" }, '<meta name="robots" content="noindex"/>');
  assert.deepEqual(evaluate(check, ok, CTX), []);
  assert.ok(evaluate(check, res(404, {}, '<meta name="robots" content="noindex"/>'), CTX).some((m) => m.includes("no-store")));
  assert.ok(evaluate(check, res(404, { "cache-control": "no-store" }, "x"), CTX).some((m) => m.includes("noindex")));
});

test("rows are printed as each check finishes (streaming)", async () => {
  const w = world();
  const events = [];
  const inner = w.fetch;
  w.fetch = async (url, init) => {
    events.push("fetch " + new URL(url).pathname);
    return inner(url, init);
  };
  await runWith(w, [], { log: (l) => events.push("log " + l.slice(0, 13).trim()) });
  const firstRow = events.findIndex((e) => e === "log PASS");
  const lastFetch = events.map((e) => e.startsWith("fetch")).lastIndexOf(true);
  assert.ok(firstRow !== -1 && firstRow < lastFetch, "first row is logged before the last request is sent");
});

test("stops with exit 1 after consecutive network errors", async () => {
  const w = world();
  w.fetch = async (url, init) => {
    w.calls.push({ path: new URL(url).pathname });
    throw new Error("down");
  };
  const { code, lines } = await runWith(w);
  assert.equal(code, 1);
  assert.equal(w.calls.length, MAX_CONSECUTIVE_NETWORK_ERRORS * 2);
  assert.ok(lines.some((l) => l.startsWith("ABORT")));
  assert.ok(lines.some((l) => /aborted early/.test(l)));
});

test("a successful check resets the consecutive network error count", async () => {
  let n = 0;
  const w = world();
  const inner = w.fetch;
  // Every 3rd request round (check+retry = 2 calls) alternates: error, error, ok ... never 3 failed checks in a row.
  w.fetch = async (url, init) => {
    n++;
    if (Math.floor((n - 1) / 2) % 3 !== 2) throw new Error("flaky");
    return inner(url, init);
  };
  const { lines } = await runWith(w);
  assert.ok(!lines.some((l) => l.startsWith("ABORT")));
});

// ---------------------------------------------------------------- EPIC 27 (VNX-2709): the board off (default) and --board

const PID = "0123456789ABCDEFGHJKMNPQRS"; // 26 characters of the ULID alphabet: a public id
const sitemapOf = (...paths) => `<urlset><url><loc>https://vnx.si/privacy</loc></url><url><loc>https://vnx.si/for-builders</loc></url>${paths.map((p) => `<url><loc>https://vnx.si${p}</loc></url>`).join("")}</urlset>`;
const fourLocales = (rest) => ["", "/vi", "/zh-hans", "/zh-hant"].map((p) => `${p}${rest}`);
const sitemapRes = (body) => res(200, { "content-type": "application/xml" }, body);
const HTML = { "content-type": "text/html" };

test("default (board off): / and /for-builders have no link to /requests; /requests is 404 in four locales; /requests/<none> is 404", () => {
  const checks = buildChecks();
  for (const id of ["page /", "page /vi/", "page /for-builders", "page /zh-hant/for-builders"]) {
    const check = byId(checks, id);
    assert.ok(check, id);
    assert.deepEqual(evaluate(check, goodResponse(check.path), CTX), [], id);
    for (const link of ['<a href="/requests">', '<a href="/vi/requests">', '<a href="/zh-hans/requests/ABC">']) {
      assert.ok(evaluate(check, res(200, HTML, link), CTX).some((m) => m.includes("links to /requests")), `${id} ${link}`);
    }
    // Other hrefs that merely start with the word are not the board link.
    assert.deepEqual(evaluate(check, res(200, HTML, '<a href="/requests-help">'), CTX), [], id);
  }
  assert.equal(byId(checks, "page /products").asserts.length, 1, "other pages are not checked for the link");
  for (const prefix of ["", "/vi", "/zh-hans", "/zh-hant"]) {
    const check = byId(checks, `board-off ${prefix}/requests`);
    assert.equal(check.status, 404);
    assert.deepEqual(evaluate(check, goodResponse(check.path), CTX), []);
    assert.ok(evaluate(check, res(200, HTML, "board"), CTX).some((m) => m.includes("status 200")), "a live board fails the default mode");
  }
  assert.equal(byId(checks, "board /requests"), undefined);
  assert.equal(byId(checks, "board-404 /requests/<none>").status, 404);
});

test("default (board off): the sitemap names nothing under /requests, in any locale", () => {
  const check = byId(buildChecks(), "sitemap.xml");
  assert.deepEqual(evaluate(check, sitemapRes(sitemapOf()), CTX), []);
  for (const loc of ["/requests", "/vi/requests", `/requests/${PID}`, `/zh-hans/requests/${PID}`]) {
    assert.ok(evaluate(check, sitemapRes(sitemapOf(loc)), CTX).some((m) => m.includes("while the board is off")), loc);
  }
  assert.deepEqual(evaluate(check, sitemapRes(sitemapOf("/requests-guide")), CTX), []); // a different path, not under /requests
});

test("--board: /requests is 200 HTML without public caching or no-referrer; an unknown listing is a noindex 404", () => {
  const checks = buildChecks({ board: true });
  assert.equal(byId(checks, "board-off /requests"), undefined);
  const list = byId(checks, "board /requests");
  assert.equal(list.status, 200);
  assert.deepEqual(evaluate(list, goodResponse("/requests", true), CTX), []);
  assert.ok(evaluate(list, res(404, HTML, "x"), CTX).some((m) => m.includes("status 404")));
  assert.ok(evaluate(list, res(200, { ...HTML, "cache-control": "public, max-age=60" }, "x"), CTX).some((m) => m.includes("cache-control")));
  assert.ok(evaluate(list, res(200, { ...HTML, "cache-control": "s-maxage=5" }, "x"), CTX).some((m) => m.includes("cache-control")));
  assert.deepEqual(evaluate(list, res(200, { ...HTML, "cache-control": "private, no-store" }, "x"), CTX), []);
  assert.ok(evaluate(list, res(200, { ...HTML, "referrer-policy": "no-referrer" }, "x"), CTX).some((m) => m.includes("referrer-policy")));
  assert.ok(evaluate(list, res(200, { "content-type": "application/json" }, "x"), CTX).length > 0);
  const missing = byId(checks, "board-404 /requests/<none>");
  assert.deepEqual(evaluate(missing, goodResponse(missing.path, true), CTX), []);
  assert.ok(evaluate(missing, res(404, HTML, "no robots"), CTX).some((m) => m.includes("noindex")));
  // The footer link is not asserted either way once the board is on.
  assert.deepEqual(evaluate(byId(checks, "page /"), res(200, HTML, '<a href="/requests">'), CTX), []);
});

test("--board: the sitemap may list the board, and only as /requests and /requests/<public id> in four locales (nothing private)", () => {
  const check = byId(buildChecks({ board: true }), "sitemap.xml");
  const ok = sitemapOf(...fourLocales("/requests"), ...fourLocales(`/requests/${PID}`));
  assert.deepEqual(evaluate(check, sitemapRes(ok), CTX), []);
  assert.deepEqual(evaluate(check, sitemapRes(sitemapOf()), CTX), [], "no listing yet is fine");
  const bad = [
    [sitemapOf(`/requests/${PID}`), "3 locales missing: the id is in the sitemap once"],
    [sitemapOf(...fourLocales("/requests/short")), "not a public id"],
    [sitemapOf(...fourLocales("/requests/lowercase0123456789abcdefgh")), "not a public id"],
    [sitemapOf(...fourLocales(`/requests/${PID}/interest`)), "unexpected board path"],
    [sitemapOf(`/me/requests/${PID}`), "private path"],
    [sitemapOf(`/ops/marketplace/requests/${PID}`), "private path"],
  ];
  for (const [body, why] of bad) assert.ok(evaluate(check, sitemapRes(body), CTX).length > 0, why);
  assert.ok(evaluate(check, sitemapRes(ok.replace("</urlset>", "<!-- request_id: 1 --></urlset>")), CTX).some((m) => m.includes("request_id")));
  // The existing rules still hold in this mode.
  assert.ok(evaluate(check, sitemapRes(sitemapOf("/ops")), CTX).some((m) => m.includes("private path")));
});

test("both modes run end to end against a model of the app and send GET/HEAD only", async () => {
  for (const board of [false, true]) {
    const w = world((path) => goodResponse(path, board));
    const { code, lines } = await runWith(w, board ? ["--board"] : []);
    assert.equal(code, 0, lines.join("\n"));
    assert.equal(lines[0].includes("--board"), board);
    assert.ok(w.calls.some((c) => c.path === "/requests"));
    for (const c of w.calls) assert.ok(c.method === "GET" || c.method === "HEAD");
  }
  // The wrong mode fails: a live board under the default, a missing board under --board.
  const live = world((path) => goodResponse(path, true));
  assert.equal((await runWith(live)).code, 1);
  const off = world((path) => goodResponse(path, false));
  assert.equal((await runWith(off, ["--board"])).code, 1);
});
