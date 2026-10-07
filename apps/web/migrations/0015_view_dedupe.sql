-- M7 VNX-0701b (spec §8.11): one row per (UTC day, day-specific visitor hash, product) so a product view counts once per visitor per day.
-- visitor_hash = HMAC(dayKey, cookie id): it changes every UTC day, cannot be joined across days, and holds no IP, e-mail or user id.
-- The daily job deletes every row of an earlier UTC day (so "deleted after 2 days" in the Privacy text is an upper bound). Written only by
-- src/db/stats.ts. Additive only; 0016 is public_stats.
CREATE TABLE product_view_dedupe (
  day          TEXT NOT NULL CHECK (day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  visitor_hash TEXT NOT NULL CHECK (length(visitor_hash) = 64 AND visitor_hash NOT GLOB '*[^0-9a-f]*'),
  product_id   TEXT NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  PRIMARY KEY (day, visitor_hash, product_id)
) WITHOUT ROWID;
