import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { buildSeed } from "../../e2e/seed/build-seed.mjs";
import { id, SESSION_RAW, TOKENS } from "../../e2e/seed/fixtures.mjs";

// AC7: the E2E seed is deterministic and gives the hourly job enough to publish every homepage block.
// The thresholds are the MIN table of apps/web/src/domain/public-stats.ts (spec 8.11); the counting mirrors apps/web/src/db/public-stats.ts.
const NOW = new Date("2026-10-10T12:00:00.000Z");
const MIGRATIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "apps", "web", "migrations");
const MIN = { products: 10, builders: 10, requests30d: 10, countries: 3, trendingScore: 20, trendingItems: 6, categoryTotal: 10, categoryRequests: 3, growthWeeks: 4, tabBuilders: 3, liveEvents: 5 };

/** A fresh in-memory database with every migration and the seed applied (foreign keys on, as D1 has them). */
function seededDb(now = NOW) {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) db.exec(readFileSync(path.join(MIGRATIONS, file), "utf8"));
  db.exec(buildSeed(now));
  return db;
}
const one = (db, sql, ...args) => db.prepare(sql).get(...args);
const PUBLIC = "p.status = 'published' AND b.status = 'approved' AND u.status = 'active'";
const day = (d) => new Date(d.getTime()).toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 86_400_000);
const isoWeekStart = (s) => {
  const d = new Date(`${s}T00:00:00Z`);
  return addDays(d, -((d.getUTCDay() + 6) % 7));
};

test("the same time gives the same SQL, another time another SQL", () => {
  assert.equal(buildSeed(NOW), buildSeed(new Date(NOW)));
  assert.notEqual(buildSeed(NOW), buildSeed(addDays(NOW, 1)));
});

test("the seed has no remote flag, no secret, and never writes public_stats (the cron computes it)", () => {
  const sql = buildSeed(NOW);
  assert.doesNotMatch(sql, /--remote/);
  assert.doesNotMatch(sql, /INSERT INTO public_stats/);
  assert.doesNotMatch(sql, /re_[A-Za-z0-9]{10,}|sk_live|0x4AAAA/);
});

test("fixture ids and tokens have the shapes the app accepts", () => {
  assert.match(id("P", 1000), /^[0-9A-HJKMNP-TV-Z]{26}$/);
  assert.match(id("K", 7), /^[0-9A-HJKMNP-TV-Z]{26}$/);
  for (const raw of [SESSION_RAW, ...Object.values(TOKENS)]) assert.match(raw, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(new Set([SESSION_RAW, ...Object.values(TOKENS)]).size, Object.keys(TOKENS).length + 1, "every token is different");
});

test("the seed applies on top of all migrations with foreign keys on", () => {
  const db = seededDb();
  for (const table of ["users", "builders", "products", "requests", "inquiries", "audit_log", "sessions", "login_tokens", "product_daily_stats", "product_verifications", "pricing_tiers"]) {
    assert.ok(one(db, `SELECT COUNT(*) AS n FROM ${table}`).n > 0, `${table} has rows`);
  }
  assert.equal(one(db, "SELECT COUNT(*) AS n FROM public_stats").n, 0);
  assert.equal(one(db, "SELECT COUNT(*) AS n FROM login_tokens WHERE purpose = 'login'").n, Object.keys(TOKENS).length);
});

test("the Numbers thresholds are met", () => {
  const db = seededDb();
  const from = `${day(addDays(NOW, -29))}T00:00:00.000Z`;
  const products = one(db, `SELECT COUNT(*) AS n FROM products p JOIN builders b ON b.user_id = p.builder_id JOIN users u ON u.id = p.builder_id WHERE ${PUBLIC}`).n;
  const builders = one(db, "SELECT COUNT(*) AS n FROM builders b JOIN users u ON u.id = b.user_id WHERE b.status = 'approved' AND u.status = 'active'").n;
  const requests = one(db, "SELECT COUNT(*) AS n FROM requests WHERE submitted_at IS NOT NULL AND submitted_at >= ? AND status <> 'removed'", from).n;
  const countries = one(db, "SELECT COUNT(DISTINCT b.country) AS n FROM builders b JOIN users u ON u.id = b.user_id WHERE b.status = 'approved' AND u.status = 'active'").n;
  assert.ok(products >= MIN.products, `products ${products}`);
  assert.ok(builders >= MIN.builders, `builders ${builders}`);
  assert.ok(requests >= MIN.requests30d, `requests ${requests}`);
  assert.ok(countries >= MIN.countries, `countries ${countries}`);
});

test("Market pulse: the request total and at least one category reach their thresholds, and a scarcest category exists", () => {
  const db = seededDb();
  const rows = db.prepare("SELECT category, COUNT(*) AS n FROM requests WHERE submitted_at IS NOT NULL AND status <> 'removed' GROUP BY category").all();
  assert.ok(rows.reduce((a, r) => a + r.n, 0) >= MIN.categoryTotal);
  assert.ok(rows.filter((r) => r.category !== "other" && r.n >= MIN.categoryRequests).length >= 1);
});

test("Growth: the first event is at least 4 ISO weeks before the current week", () => {
  const db = seededDb();
  const first = one(db, "SELECT MIN(d) AS d FROM (SELECT substr(first_published_at, 1, 10) AS d FROM products WHERE status = 'published' UNION ALL SELECT substr(approved_at, 1, 10) FROM builders WHERE status = 'approved')").d;
  const weeks = (isoWeekStart(day(NOW)) - isoWeekStart(first)) / (7 * 86_400_000) + 1;
  assert.ok(weeks >= MIN.growthWeeks, `${weeks} weeks`);
});

test("Trending: at least 6 public products score 20 or more in the last 7 days", () => {
  const db = seededDb();
  const from = day(addDays(NOW, -6));
  const scored = db
    .prepare(
      `SELECT p.id, COALESCE((SELECT SUM(s.views + 2 * s.demo_clicks) FROM product_daily_stats s WHERE s.product_id = p.id AND s.day >= ?1), 0)
            + 5 * (SELECT COUNT(*) FROM inquiries i WHERE i.product_id = p.id AND i.opened_at IS NOT NULL AND i.status <> 'removed' AND i.opened_at >= ?2) AS score
       FROM products p JOIN builders b ON b.user_id = p.builder_id JOIN users u ON u.id = p.builder_id WHERE ${PUBLIC}`,
    )
    .all(from, `${from}T00:00:00.000Z`);
  assert.ok(scored.filter((r) => r.score >= MIN.trendingScore).length >= MIN.trendingItems);
});

test("Top builders: at least 3 builders have a verified product", () => {
  const db = seededDb();
  const n = one(
    db,
    `SELECT COUNT(*) AS n FROM builders b JOIN users u ON u.id = b.user_id WHERE b.status = 'approved' AND u.status = 'active'
       AND EXISTS (SELECT 1 FROM products p WHERE p.builder_id = b.user_id AND p.status = 'published'
         AND EXISTS (SELECT 1 FROM product_verifications v WHERE v.product_id = p.id AND v.kind IN ('demo_verified', 'in_production') AND v.revoked_at IS NULL))`,
  ).n;
  assert.ok(n >= MIN.tabBuilders, `verified builders ${n}`);
});

test("Live: at least 5 public events in the last 7 days, badge events matching their verification", () => {
  const db = seededDb();
  const from = `${day(addDays(NOW, -6))}T00:00:00.000Z`;
  const q = (sql) => one(db, sql, from).n;
  const published = q(`SELECT COUNT(*) AS n FROM audit_log a JOIN products p ON p.id = a.entity_id JOIN builders b ON b.user_id = p.builder_id JOIN users u ON u.id = p.builder_id WHERE a.action = 'product.approve' AND a.entity = 'product' AND a.created_at >= ?1 AND ${PUBLIC}`);
  const badges = q(`SELECT COUNT(*) AS n FROM audit_log a JOIN products p ON p.id = a.entity_id JOIN builders b ON b.user_id = p.builder_id JOIN users u ON u.id = p.builder_id
    WHERE a.action = 'badge.grant' AND a.entity = 'product' AND a.created_at >= ?1 AND ${PUBLIC} AND json_extract(a.data, '$.kind') IN ('demo_verified', 'in_production')
      AND EXISTS (SELECT 1 FROM product_verifications v WHERE v.product_id = p.id AND v.kind = json_extract(a.data, '$.kind') AND v.verified_at = a.created_at AND v.revoked_at IS NULL)`);
  const approved = q("SELECT COUNT(*) AS n FROM audit_log a JOIN builders b ON b.user_id = a.entity_id JOIN users u ON u.id = b.user_id WHERE a.action = 'builder.approve' AND a.entity = 'builder' AND a.created_at >= ?1 AND b.status = 'approved' AND u.status = 'active'");
  const requests = q("SELECT COUNT(*) AS n FROM audit_log a JOIN requests r ON r.id = a.entity_id WHERE a.action IN ('request.verify', 'request.submit') AND a.entity = 'request' AND a.created_at >= ?1 AND r.status <> 'removed'");
  assert.ok(badges >= 1, "badge events join their verification");
  assert.ok(published + badges + approved + requests >= MIN.liveEvents, `live events ${published + badges + approved + requests}`);
});

test("the session and the login tokens are stored as sha256 hashes, never raw", () => {
  const db = seededDb();
  assert.equal(one(db, "SELECT COUNT(*) AS n FROM sessions WHERE id_hash = ?", SESSION_RAW).n, 0);
  for (const raw of Object.values(TOKENS)) assert.equal(one(db, "SELECT COUNT(*) AS n FROM login_tokens WHERE token_hash = ?", raw).n, 0);
  assert.match(one(db, "SELECT id_hash FROM sessions").id_hash, /^[0-9a-f]{64}$/);
});

test("the expired token is expired and the others are valid for hours", () => {
  const db = seededDb();
  const rows = db.prepare("SELECT expires_at FROM login_tokens ORDER BY expires_at").all();
  assert.equal(rows.filter((r) => r.expires_at < NOW.toISOString()).length, 1);
  assert.equal(rows.filter((r) => r.expires_at > NOW.toISOString()).length, Object.keys(TOKENS).length - 1);
});
