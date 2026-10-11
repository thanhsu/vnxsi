import { createHash } from "node:crypto";
import { CLIENT, COUNTRIES, DRAFT_PRODUCT, id, MAIN, MARKET_BUILDERS, OPS, OTHER, OTHER_PRODUCT, PUBLISHED_PRODUCT, SESSION_RAW, SESSION_RAW_CLIENT, SESSION_RAW_OPS, TOKENS } from "./fixtures.mjs";

// Deterministic SQL for the E2E database (same `now`, same text). It writes SOURCE tables only (users, builders, products,
// requests, audit_log ...), never `public_stats`: the hourly cron runs for real and computes the homepage blocks from them.
// No money enters any ranking (ADR-004): the one price is a tier of the published product, which no formula reads.
// Avoid semicolons inside values: the file is one statement per line.

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** @param {Date} now @param {number} ms */
const at = (now, ms) => new Date(now.getTime() + ms).toISOString();
const sha256 = (s) => createHash("sha256").update(s, "utf8").digest("hex");

/** SQL literal. */
function q(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  return `'${String(v).replaceAll("'", "''")}'`;
}
const insert = (table, row) => `INSERT INTO ${table} (${Object.keys(row).join(", ")}) VALUES (${Object.values(row).map(q).join(", ")});`;

/** Category of market request n (1-based): 4 + 4 + 4, each group >= 3 and the total >= 10. */
const requestCategory = (n) => (n <= 4 ? "booking" : n <= 8 ? "crm" : "ecommerce");
/** Category of market product n: many in ecommerce, few in booking and crm, so a scarcest category exists. */
const productCategory = (n) => (n <= 6 ? "ecommerce" : n <= 9 ? "booking" : n <= 11 ? "crm" : "finance");

/**
 * @param {Date} [now]
 * @returns {string} SQL, one statement per line
 */
export function buildSeed(now = new Date()) {
  const rows = [];
  const add = (table, row) => rows.push(insert(table, row));
  const stamp = at(now, 0);

  const user = (u, locale = "en", isAdmin = 0) =>
    add("users", { id: u.userId, email: u.email, display_name: u.name, locale, is_admin: isAdmin, status: "active", created_at: at(now, -60 * DAY), updated_at: stamp });
  const builder = (u, extra) =>
    add("builders", {
      user_id: u.userId, handle: u.handle, name: u.name, kind: "individual", headline: `${u.name} builds small business tools`, bio: `${u.name} is sample data for the E2E suite.`,
      country: u.country, website_url: null, skills: '["web"]', ai_tools: '["claude"]', work_languages: '["en","vi"]', availability: "open", hourly_rate_cents: null,
      status: "approved", approved_at: stamp, created_at: at(now, -60 * DAY), updated_at: stamp, ...extra,
    });
  const product = (p, builderId, extra) =>
    add("products", {
      id: p.id, builder_id: builderId, slug: p.slug, status: "draft", primary_lang: "en", name: p.name, tagline: "", problem: "", target_users: "", description: "",
      category: null, tags: "[]", features: "[]", tech_stack: "[]", delivery_model: null, license: null, demo_url: null, website_url: null, customizable: 0,
      customization_notes: "", support_policy: "", first_published_at: null, published_at: null, created_at: at(now, -50 * DAY), updated_at: stamp, ...extra,
    });

  // People the tests sign in as, or send to.
  user(MAIN);
  user(OTHER);
  user(CLIENT);
  user(OPS, "en", 1);
  builder(MAIN, { approved_at: at(now, -45 * DAY) });
  builder(OTHER, { approved_at: at(now, -44 * DAY) });

  // The main builder's products: one public (inquiry target, axe page), one draft (editor), plus another builder's draft (isolation test).
  product(PUBLISHED_PRODUCT, MAIN.userId, {
    status: "published", tagline: "A sample product for the E2E suite", problem: "Sample problem text.", target_users: "Sample users.",
    description: "Sample description of the published product.", category: "ecommerce", tags: '["sample"]', features: '["First feature"]', tech_stack: '["TypeScript"]',
    delivery_model: "saas", support_policy: "Email support.", first_published_at: at(now, -40 * DAY), published_at: at(now, -40 * DAY),
  });
  product(DRAFT_PRODUCT, MAIN.userId, { tagline: "Draft tagline" });
  product(OTHER_PRODUCT, OTHER.userId, { tagline: "Not yours" });
  add("pricing_tiers", { id: id("T", 1), product_id: PUBLISHED_PRODUCT.id, name: "Starter", price_cents: 4900, billing: "one_time", description: "Sample tier", sort: 0, created_at: at(now, -40 * DAY) });

  // Market: 12 approved builders in 4 countries, one published product each, spread over 6 weeks (the growth chart needs >= 4 weeks).
  for (let n = 1; n <= MARKET_BUILDERS; n++) {
    const k = String(n).padStart(2, "0");
    const u = { userId: id("K", n), email: `e2e-market-${k}@example.test`, handle: `market-${k}`, name: `Market Builder ${k}`, country: COUNTRIES[(n - 1) % COUNTRIES.length] };
    const days = -(2 + Math.floor(((n - 1) * 38) / (MARKET_BUILDERS - 1)));
    user(u);
    builder(u, { approved_at: at(now, days * DAY - 3 * HOUR) });
    product({ id: id("P", n), slug: `market-product-${k}`, name: `Market Product ${k}` }, u.userId, {
      status: "published", tagline: `Sample product ${k}`, problem: "Sample problem.", target_users: "Sample users.", description: "Sample description.", category: productCategory(n),
      tags: '["sample"]', features: '["Feature"]', tech_stack: '["TypeScript"]', delivery_model: "saas", support_policy: "Email.",
      first_published_at: at(now, days * DAY), published_at: at(now, days * DAY),
    });
  }

  // 12 submitted requests inside the 30-day window, 4 per category (homepage Numbers, Market pulse).
  for (let n = 1; n <= 12; n++) {
    add("requests", {
      id: id("R", n), client_user_id: CLIENT.userId, client_name: CLIENT.name, title: `Sample request ${n}`, description: "Sample request text for the E2E suite.", category: requestCategory(n),
      budget_band: "unsure", deadline: null, languages: '["en"]', status: "submitted", locale: "en", submitted_at: at(now, -(1 + n) * DAY), created_at: at(now, -(1 + n) * DAY), updated_at: stamp,
    });
  }

  // Trending: 8 products with 30+ views yesterday (score >= 20 inside the last 7 days), the top 6 are shown.
  const yesterday = at(now, -DAY).slice(0, 10);
  const dayBefore = at(now, -2 * DAY).slice(0, 10);
  for (let n = 1; n <= 8; n++) {
    add("product_daily_stats", { product_id: id("P", n), day: yesterday, views: 30 + n, demo_clicks: 2, outbound_clicks: 0, inquiries: 0 });
    add("product_daily_stats", { product_id: id("P", n), day: dayBefore, views: 12, demo_clicks: 0, outbound_clicks: 0, inquiries: 0 });
  }
  // Inquiries that really opened (counted by Trending and Top products). The client is a separate user, never the builder.
  for (let n = 1; n <= 3; n++) {
    add("inquiries", {
      id: id("J", n), client_user_id: CLIENT.userId, client_name: CLIENT.name, builder_id: id("K", n), product_id: id("P", n), request_id: null, type: "buy", message: "Sample inquiry message for the E2E suite.",
      budget_band: "unsure", deadline: null, status: "open", locale: "en", opened_at: at(now, -DAY), last_activity_at: at(now, -DAY), created_at: at(now, -DAY), updated_at: at(now, -DAY),
    });
  }

  // Badges: 3 builders with a verified product (the "verified" tab of Top builders needs 3). verified_at equals the audit row time, as loadLiveEvents joins them.
  for (let n = 1; n <= 3; n++) {
    const when = at(now, -(n + 1) * HOUR);
    add("product_verifications", { id: id("V", n), product_id: id("P", n), kind: "demo_verified", verified_by: null, evidence: "Sample evidence", verified_at: when, revoked_at: null, revoke_reason: null });
    add("audit_log", { id: id("A", n), actor_user_id: null, action: "badge.grant", entity: "product", entity_id: id("P", n), data: JSON.stringify({ kind: "demo_verified" }), created_at: when });
  }
  // Live strip: 3 publications, 3 builder approvals, 5 new requests, plus the 3 badges above = 14 public events in the last 7 days.
  for (let n = 4; n <= 6; n++) {
    add("audit_log", { id: id("A", 10 + n), actor_user_id: null, action: "product.approve", entity: "product", entity_id: id("P", n), data: "{}", created_at: at(now, -(n + 5) * HOUR) });
  }
  for (let n = 1; n <= 3; n++) {
    add("audit_log", { id: id("A", 20 + n), actor_user_id: null, action: "builder.approve", entity: "builder", entity_id: id("K", n), data: "{}", created_at: at(now, -(n + 12) * HOUR) });
  }
  for (let n = 1; n <= 5; n++) {
    add("audit_log", { id: id("A", 30 + n), actor_user_id: null, action: "request.submit", entity: "request", entity_id: id("R", n), data: JSON.stringify({ category: requestCategory(n), languages: ["en"] }), created_at: at(now, -(n + 18) * HOUR) });
  }

  // EPIC 27 (VNX-2703b): three submitted requests with NO publication, for the client's opt-in from /me (request-board-forms.spec.ts takes one per attempt,
  // R 2005 + retry). Older than 30 days so no homepage number moves; the original title starts with "E2E private original".
  for (let n = 2005; n <= 2007; n++) {
    const when = at(now, -40 * DAY);
    add("requests", {
      id: id("R", n), client_user_id: CLIENT.userId, client_name: CLIENT.name, title: `E2E private original ${n}`, description: `E2E private original description ${n}, written by the client before the board existed.`, category: "booking",
      budget_band: "unsure", deadline: null, languages: '["en"]', status: "submitted", locale: "en", submitted_at: when, created_at: when, updated_at: when,
    });
  }

  // EPIC 27 (VNX-2704a): three submitted requests whose client opted in to the public board, each with a publication waiting for review. The Ops spec
  // (request-board-forms.spec.ts) moderates one per attempt (R 2008 + retry). Older than 30 days so no homepage number moves; the client's original title
  // starts with "E2E private original" and the public wording Ops writes starts with "E2E board", so a leak of the original is detectable.
  for (let n = 2008; n <= 2010; n++) {
    const when = at(now, -40 * DAY);
    add("requests", {
      id: id("R", n), client_user_id: CLIENT.userId, client_name: CLIENT.name, title: `E2E private original ${n}`, description: `E2E private original description ${n}, written by the client with details only Ops may read.`, category: "booking",
      budget_band: "unsure", deadline: null, languages: '["en"]', status: "submitted", locale: "en", submitted_at: when, created_at: when, updated_at: when,
    });
    add("request_publications", { request_id: id("R", n), public_id: id("Q", n), status: "pending_review", opted_in_at: when, consent_version: "2026-01-01", created_at: when, updated_at: when });
  }

  // EPIC 27: the request board flag is on in this database (the date half of the gate is REQUEST_BOARD_GO_LIVE in e2e/scripts/serve.mjs).
  add("feature_flags", { key: "request_board", enabled: 1, updated_by: null, updated_at: stamp, write_id: null });

  // Session of the main builder (no mail needed) and the one-use login links.
  add("sessions", { id_hash: sha256(SESSION_RAW), user_id: MAIN.userId, expires_at: at(now, 30 * DAY), created_at: stamp });
  // The staff user's session (method defaults to magic_link, the only one /ops accepts).
  add("sessions", { id_hash: sha256(SESSION_RAW_OPS), user_id: OPS.userId, expires_at: at(now, 30 * DAY), created_at: stamp });
  // The seeded client's session (VNX-2703b; method defaults to magic_link): the owner of every seeded request, for /me.
  add("sessions", { id_hash: sha256(SESSION_RAW_CLIENT), user_id: CLIENT.userId, expires_at: at(now, 30 * DAY), created_at: stamp });
  for (const [name, raw] of Object.entries(TOKENS)) {
    add("login_tokens", {
      token_hash: sha256(raw), email: MAIN.email, purpose: "login", locale: "en", inquiry_id: null, request_id: null, invite_code_hash: null,
      expires_at: name === "EXPIRED" ? at(now, -HOUR) : at(now, 12 * HOUR), used_at: null, created_at: at(now, -HOUR),
    });
  }
  return `${rows.join("\n")}\n`;
}
