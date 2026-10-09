// Production smoke checks (VNX-0805). Pure logic: the check table, the assertions, the pacing and the runner.
// All I/O is injected into run() (fetch, sleep, now, log), so tests drive it with fakes. No process.exit here;
// scripts/smoke.mjs is the thin shell. Read-only by design: every check is GET or HEAD, no cookie, no credential.
import { parseArgs as nodeParseArgs } from "node:util";

export const DEFAULT_BASE = "https://vnx.si";
export const USER_AGENT = "vnxsi-smoke/1";
export const TIMEOUT_MS = 10_000;
export const RETRY_DELAY_MS = 3_000;
export const RATE_LIMIT_WAIT_MS = 11_000;
export const GAP_MS = 100;
export const COVERED_GAP_MS = 600;
// The Cloudflare rule is 20 requests / 10 s / IP on /p/* and /go/*; we never send more than half of it.
export const WINDOW_MS = 10_000;
export const WINDOW_MAX = 10;

export const LOCALE_PREFIXES = ["", "/vi", "/zh-hans", "/zh-hant"];
const SLUG_OK = /^[a-z0-9][a-z0-9-]{0,63}$/;
// A slug that cannot exist: products never start with "zz-smoke".
const MISSING = "zz-smoke-no-such-thing";

export class UsageError extends Error {}

// ---------------------------------------------------------------- arguments

/** @returns {{base: string, slug: string | null}} @throws {UsageError} */
export function parseArgs(argv, env = {}) {
  let values;
  try {
    ({ values } = nodeParseArgs({ args: argv, options: { base: { type: "string" }, slug: { type: "string" } }, strict: true, allowPositionals: false }));
  } catch (err) {
    throw new UsageError(String(err.message ?? err));
  }
  const raw = values.base ?? env.BASE_URL ?? DEFAULT_BASE;
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new UsageError(`invalid base URL: ${raw}`);
  }
  const local = url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if (url.protocol !== "https:" && !local) throw new UsageError(`base must be https:// or http://localhost|127.0.0.1, got: ${raw}`);
  if ((url.pathname !== "/" && url.pathname !== "") || url.search || url.hash || url.username) throw new UsageError(`base must be an origin only, got: ${raw}`);
  const slug = values.slug ?? null;
  if (slug !== null && !SLUG_OK.test(slug)) throw new UsageError(`invalid --slug: ${slug}`);
  return { base: url.origin, slug };
}

// ---------------------------------------------------------------- assertions
// An assertion is (res, ctx) => null | "reason". res = {status, headers (Headers), body}; ctx = {base, isProd}.

const hdr = (res, name) => res.headers.get(name) ?? "";
const lower = (s) => s.toLowerCase();

export const isHtml = (res) => (lower(hdr(res, "content-type")).startsWith("text/html") ? null : `content-type is "${hdr(res, "content-type")}", want text/html`);
export const headerIncludes = (name, needle) => (res) => (lower(hdr(res, name)).includes(lower(needle)) ? null : `${name} lacks "${needle}" (got "${hdr(res, name)}")`);
export const headerIs = (name, value) => (res) => (hdr(res, name) === value ? null : `${name} is "${hdr(res, name)}", want "${value}"`);
export const bodyIncludes = (needle) => (res) => (res.body.includes(needle) ? null : `body lacks ${JSON.stringify(needle)}`);
export const bodyExcludes = (needle) => (res) => (res.body.includes(needle) ? `body contains ${JSON.stringify(needle)}` : null);
export const contentTypeIs = (type) => (res) => (lower(hdr(res, "content-type")).startsWith(type) ? null : `content-type is "${hdr(res, "content-type")}", want ${type}`);
/** noindex via the X-Robots-Tag header or the page's own <meta name="robots">. */
export const noindexAny = (res) =>
  /noindex/i.test(hdr(res, "x-robots-tag")) || /<meta\s+name="robots"\s+content="[^"]*noindex/i.test(res.body) ? null : "no noindex (neither X-Robots-Tag nor meta robots)";
export const locationIs = (expected) => (res) => (hdr(res, "location") === expected ? null : `Location is "${hdr(res, "location")}", want "${expected}"`);
export const locationIsHttps = (res) => (/^https:\/\//i.test(hdr(res, "location")) ? null : `Location is "${hdr(res, "location")}", want an https URL`);

export const cspStrict = (res) => {
  const csp = hdr(res, "content-security-policy");
  if (!csp) return "Content-Security-Policy missing";
  for (const need of ["default-src 'self'", "frame-ancestors 'none'"]) if (!csp.includes(need)) return `CSP lacks ${need}`;
  for (const bad of ["unsafe-inline", "unsafe-eval"]) if (csp.includes(bad)) return `CSP contains ${bad}`;
  return null;
};
export const hstsOneYear = (res, ctx) => (!ctx.isProd || hdr(res, "strict-transport-security").includes("max-age=31536000") ? null : `Strict-Transport-Security is "${hdr(res, "strict-transport-security")}"`);

const baseHeaders = [cspStrict, headerIncludes("x-content-type-options", "nosniff"), headerIs("x-frame-options", "DENY"), hstsOneYear];
const SITEMAP_PRIVATE = ["/ops", "/go", "/hub", "/admin", "/me"];

const robotsAssert = (res, ctx) => {
  const ct = contentTypeIs("text/plain")(res);
  if (ct) return ct;
  const lines = res.body.split(/\r?\n/);
  for (const want of ["Disallow: /ops", "Disallow: /go/", "Disallow: /hub", "Disallow: /vi/hub", "Allow: /media/products/"]) if (!lines.includes(want)) return `robots.txt lacks line "${want}"`;
  const sm = lines.find((l) => l.startsWith("Sitemap:"));
  if (!sm) return "robots.txt has no Sitemap: line";
  const url = sm.slice("Sitemap:".length).trim();
  if (!url.endsWith("/sitemap.xml")) return `Sitemap line is "${url}", want .../sitemap.xml`;
  if (ctx.isProd && url !== `${ctx.base}/sitemap.xml`) return `Sitemap line is "${url}", want "${ctx.base}/sitemap.xml"`;
  return null;
};

const sitemapAssert = (res) => {
  if (!res.body.includes("<urlset")) return "sitemap has no <urlset";
  for (const want of ["/privacy", "/for-builders"]) if (!res.body.includes(want)) return `sitemap lacks ${want}`;
  // <loc> only: hreflang hrefs share the same paths, so checking locs is enough.
  const locs = [...res.body.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
  for (const bad of SITEMAP_PRIVATE) {
    const hit = locs.find((l) => {
      const path = new URL(l).pathname.replace(/^\/(vi|zh-hans|zh-hant)(?=\/|$)/, "");
      return path === bad || path.startsWith(bad + "/");
    });
    if (hit) return `sitemap lists private path ${hit}`;
  }
  return null;
};

export const LAST_UPDATED_RE = /Last updated:\s*(\d{4}-\d{2}-\d{2})/;
export function extractLastUpdated(body) {
  const m = LAST_UPDATED_RE.exec(body);
  return m ? m[1] : null;
}
const privacyAssert = (res) => (extractLastUpdated(res.body) ? null : 'privacy page has no "Last updated: YYYY-MM-DD" line');

// ---------------------------------------------------------------- the table

/** True when the request falls under the Cloudflare rate-limit rule (/p/* in every locale, and /go/*). */
export function isRateCovered(path) {
  const rest = path.replace(/^\/(vi|zh-hans|zh-hant)(?=\/|$)/, "");
  return rest.startsWith("/p/") || rest.startsWith("/go/");
}

/**
 * Check = { id, path, method: GET|HEAD, status, asserts: [fn], capture?: fn(res) -> string|null }.
 * Verified against apps/web/src (app.ts, routes/, http/security-headers.ts, views/seo.ts) and real responses.
 */
export function buildChecks({ slug = null } = {}) {
  const checks = [];
  const add = (c) => checks.push({ method: "GET", asserts: [], ...c });

  // 1. Public pages, four locales.
  for (const prefix of LOCALE_PREFIXES) {
    for (const rest of ["/", "/products", "/builders", "/request", "/for-builders", "/privacy", "/terms", "/contact", "/login"]) {
      const path = rest === "/" ? prefix + "/" : prefix + rest;
      add({ id: `page ${path}`, path, status: 200, asserts: [isHtml] });
    }
  }

  // 2. Auth redirects: 303 to the localized /login, with next= set to the requested path.
  for (const prefix of LOCALE_PREFIXES) {
    for (const rest of ["/admin", "/hub", "/me"]) {
      const path = prefix + rest;
      add({ id: `login-redirect ${path}`, path, status: 303, asserts: [locationIs(`${prefix}/login?next=${encodeURIComponent(path)}`)] });
    }
  }

  // 3. Ops console: sealed 404, never stored, never indexed. Only the canonical, unprefixed /ops carries the Ops
  //    headers (app.ts mounts opsHeaders on /ops and /ops/*), so /vi/ops is a plain 404 and only the status is checked.
  for (const path of ["/ops", "/ops/x"]) {
    add({ id: `ops-sealed ${path}`, path, status: 404, asserts: [headerIncludes("cache-control", "no-store"), headerIncludes("x-robots-tag", "noindex")] });
  }
  add({ id: "ops-not-localized /vi/ops", path: "/vi/ops", status: 404 });

  // 4. Unknown product / outbound paths: 404 and noindex (X-Robots-Tag on /go, meta robots on /p error pages).
  for (const prefix of LOCALE_PREFIXES) add({ id: `product-404 ${prefix}/p/<none>`, path: `${prefix}/p/${MISSING}`, status: 404, asserts: [noindexAny] });
  add({ id: "go-404 /go/p/<none>/demo", path: `/go/p/${MISSING}/demo`, status: 404, asserts: [noindexAny, headerIncludes("cache-control", "no-store")] });
  add({ id: "go-404 /go/<none>", path: `/go/${MISSING}`, status: 404, asserts: [noindexAny, headerIncludes("cache-control", "no-store")] });

  // 5-6. robots and sitemap.
  add({ id: "robots.txt", path: "/robots.txt", status: 200, asserts: [robotsAssert] });
  add({ id: "sitemap.xml", path: "/sitemap.xml", status: 200, asserts: [contentTypeIs("application/xml"), sitemapAssert] });

  // 7. Security headers on a normal page and on a localized 404 page.
  const referrerNormal = headerIs("referrer-policy", "strict-origin-when-cross-origin");
  add({ id: "headers /", path: "/", status: 200, asserts: [...baseHeaders, referrerNormal] });
  add({ id: "headers 404 page", path: "/vi/zz-smoke-404", status: 404, asserts: [...baseHeaders, referrerNormal] });
  // /go 404s carry the default Referrer-Policy (go.ts sets `origin` only on the 302), so `origin` is asserted only
  // for the real redirect below. /auth/verify keeps its stricter policy; a GET without a token is an invalid-link page.
  add({ id: "headers /auth/verify", path: "/auth/verify", status: 400, asserts: [headerIs("referrer-policy", "same-origin"), headerIncludes("cache-control", "no-store")] });

  // 8. Privacy page: the "Last updated" date is printed, never compared.
  add({ id: "privacy last-updated", path: "/privacy", status: 200, asserts: [privacyAssert], capture: (res) => extractLastUpdated(res.body) });

  // 9. Health.
  add({ id: "api/health", path: "/api/health", status: 200, asserts: [(res) => { try { return JSON.parse(res.body).ok === true ? null : "ok is not true"; } catch { return "body is not JSON"; } }] });

  // Optional: a real product. HEAD only: the handlers answer HEAD but never record a view or click for it.
  if (slug !== null) {
    add({ id: `product page /p/${slug}`, path: `/p/${slug}`, method: "HEAD", status: 200, asserts: [isHtml] });
    add({
      id: `go-redirect /go/p/${slug}/demo`,
      path: `/go/p/${slug}/demo`,
      method: "HEAD",
      status: 302,
      asserts: [locationIsHttps, headerIs("referrer-policy", "origin"), headerIncludes("x-robots-tag", "noindex")],
    });
  }
  for (const c of checks) c.covered = isRateCovered(c.path);
  return checks;
}

// ---------------------------------------------------------------- evaluation

/** @returns {string[]} failure reasons, empty when the check passes. */
export function evaluate(check, res, ctx = { base: DEFAULT_BASE, isProd: true }) {
  const out = [];
  if (res.status !== check.status) out.push(`status ${res.status}, want ${check.status}`);
  for (const assertion of check.asserts ?? []) {
    const msg = assertion(res, ctx);
    if (msg) out.push(msg);
  }
  return out;
}

/** Requests the table would send to the rate-limited paths. */
export function buildBudgetPlan(checks) {
  return { covered: checks.filter((c) => c.covered).length, total: checks.length };
}

// ---------------------------------------------------------------- runner

const pad = (s, n) => (s.length >= n ? s : s + " ".repeat(n - s.length));

/**
 * Runs every check sequentially. Exit code: 0 no FAIL, 1 at least one FAIL, 2 bad arguments (nothing is sent).
 * io = { fetch, sleep(ms), now(), log(line), checks? (tests only) }.
 */
export async function run({ argv = [], env = {}, fetch: doFetch, sleep, now, log = console.log, checks: override }) {
  let opts;
  try {
    opts = parseArgs(argv, env);
  } catch (err) {
    if (!(err instanceof UsageError)) throw err;
    log(`smoke: ${err.message}`);
    log("usage: npm run smoke -- [--base <url>] [--slug <product-slug>]   (BASE_URL env also accepted)");
    return 2;
  }
  const ctx = { base: opts.base, isProd: new URL(opts.base).hostname === "vnx.si" };
  const checks = override ?? buildChecks({ slug: opts.slug });
  const stamps = []; // times of rate-covered requests inside the sliding window
  let lastCovered = null;

  async function pace(covered) {
    if (!covered) return sleep(GAP_MS);
    for (;;) {
      const t = now();
      while (stamps.length && t - stamps[0] >= WINDOW_MS) stamps.shift();
      const sinceLast = lastCovered === null ? Infinity : t - lastCovered;
      if (stamps.length >= WINDOW_MAX) await sleep(stamps[0] + WINDOW_MS - t);
      else if (sinceLast < COVERED_GAP_MS) await sleep(COVERED_GAP_MS - sinceLast);
      else break;
    }
    lastCovered = now();
    stamps.push(lastCovered);
  }

  async function once(check) {
    await pace(check.covered);
    const send = async () => {
      const res = await doFetch(opts.base + check.path, {
        method: check.method,
        redirect: "manual",
        headers: { "user-agent": USER_AGENT },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const body = check.method === "HEAD" ? "" : await res.text();
      return { status: res.status, headers: res.headers, body };
    };
    let res = await send();
    if (res.status === 429) {
      log(`  warning: ${check.path} rate limited (429); waiting ${RATE_LIMIT_WAIT_MS / 1000}s and retrying once`);
      await sleep(RATE_LIMIT_WAIT_MS);
      await pace(check.covered);
      res = await send();
    }
    return res;
  }

  async function attempt(check) {
    try {
      const res = await once(check);
      return { reasons: evaluate(check, res, ctx), res };
    } catch (err) {
      return { reasons: [`request failed: ${err?.name ?? "Error"}: ${err?.message ?? err}`], res: null };
    }
  }

  const rows = [];
  let privacy = null;
  const counts = { pass: 0, retry: 0, fail: 0 };
  for (const check of checks) {
    let r = await attempt(check);
    let status = "PASS";
    if (r.reasons.length) {
      await sleep(RETRY_DELAY_MS);
      r = await attempt(check);
      status = r.reasons.length ? "FAIL" : "PASS (retry)";
    }
    if (status === "FAIL") counts.fail++;
    else if (status === "PASS") counts.pass++;
    else counts.retry++;
    if (r.res && check.capture && !r.reasons.length) privacy = check.capture(r.res);
    rows.push({ status, id: check.id, detail: r.reasons.length ? r.reasons.join("; ") : `${check.method} ${check.path} -> ${r.res.status}` });
  }

  log(`smoke ${opts.base}${ctx.isProd ? "" : " (non-production: HSTS and sitemap origin not asserted)"}`);
  const w = Math.max(5, ...rows.map((r) => r.id.length));
  log(`${pad("STATUS", 13)} ${pad("check", w)} detail`);
  for (const r of rows) log(`${pad(r.status, 13)} ${pad(r.id, w)} ${r.detail}`);
  log(`${counts.pass} pass, ${counts.retry} pass-after-retry, ${counts.fail} fail`);
  log(`Privacy: Last updated ${privacy ?? "not found"}`);
  return counts.fail > 0 ? 1 : 0;
}
