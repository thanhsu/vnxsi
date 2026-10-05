-- EPIC 21 outbound clicks (addendum §2.2; created here because VNX-0707 is not done, and M7 reuses this table without a second migration). Additive only.
-- Never a column for an IP address, an e-mail address or a user id (Privacy). `visitor_hash` stays NULL until M7.
-- No foreign keys (Reviewer-accepted deviation from §2.2, which only said offers did not exist yet): an append-only log;
-- products are deletable, offers are never deleted, and tests use synthetic ids.
CREATE TABLE outbound_clicks (
  id            TEXT PRIMARY KEY,
  product_id    TEXT,
  offer_id      TEXT,
  link_kind     TEXT NOT NULL CHECK (link_kind IN ('demo', 'site', 'offer')),
  src           TEXT NOT NULL CHECK (src IN ('product_page', 'builder_page', 'catalog', 'home', 'article', 'tools', 'unknown')),
  locale        TEXT NOT NULL CHECK (locale IN ('en', 'vi', 'zh-Hans', 'zh-Hant')),
  visitor_hash  TEXT,
  country       TEXT,
  referrer_host TEXT,
  is_bot        INTEGER NOT NULL CHECK (is_bot IN (0, 1)),
  created_at    TEXT NOT NULL,
  CHECK (product_id IS NOT NULL OR offer_id IS NOT NULL)
);
CREATE INDEX idx_clicks_product ON outbound_clicks (product_id, created_at);
CREATE INDEX idx_clicks_offer ON outbound_clicks (offer_id, created_at);
CREATE INDEX idx_clicks_visitor ON outbound_clicks (visitor_hash, product_id, link_kind, created_at);
-- Not in the addendum: lets the retention job find old rows without scanning the table.
CREATE INDEX idx_clicks_created ON outbound_clicks (created_at);
