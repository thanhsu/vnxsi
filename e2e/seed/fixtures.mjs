// Constants of the E2E seed. Fake data, only ever written into e2e/.state (a local D1), never to a real database.
// Every id, handle and raw token is fixed, so a spec can name them and the seed is the same on every run.

/** A 26-character id shaped like a ULID (Crockford base 32 has no I, L, O or U: kinds used are K user, P product, R request, J inquiry, V verification, A audit, T tier). */
export const id = (kind, n) => `01E2E${kind}${String(n).padStart(20, "0")}`;

/** A 43-character token of [A-Za-z0-9_-] (the shape `consumeLoginToken` and the session middleware accept). */
const token = (label) => `e2e-${label}-0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ`.slice(0, 43);

export const MAIN = { userId: id("K", 1000), email: "e2e-builder@example.test", handle: "e2e-builder", name: "E2E Builder", country: "VN" };
export const OTHER = { userId: id("K", 1001), email: "e2e-other@example.test", handle: "e2e-other", name: "E2E Other Builder", country: "SG" };
export const CLIENT = { userId: id("K", 1002), email: "e2e-client@example.test", name: "E2E Client" };

export const PUBLISHED_PRODUCT = { id: id("P", 1000), slug: "e2e-published-product", name: "E2E Published Product" };
export const DRAFT_PRODUCT = { id: id("P", 1001), slug: "e2e-draft-product", name: "E2E Draft Product" };
export const OTHER_PRODUCT = { id: id("P", 1002), slug: "e2e-other-product", name: "E2E Other Product" };

/** Raw session cookie value of the main builder. Only its sha256 is stored. */
export const SESSION_RAW = token("session");

/** One-use login links, one per test that spends it. Only the sha256 is stored. */
export const TOKENS = {
  OK_1: token("login-ok-1"),
  OK_2: token("login-ok-2"),
  OK_NEXT: token("login-next-ok"),
  OK_NEXT_EVIL: token("login-next-evil"),
  OK_A11Y: token("login-a11y"),
  EXPIRED: token("login-expired"),
};

/** The four countries of the market builders: the homepage "countries" number needs 3. */
export const COUNTRIES = ["VN", "US", "SG", "DE"];
export const MARKET_BUILDERS = 12;
