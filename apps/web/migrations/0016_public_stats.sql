-- M7 VNX-0702 (spec §8.11): hourly snapshot of the public homepage numbers. Additive only.
-- One row per key; `value` is JSON (the JSON null when the number is under its threshold); `computed_at` is the
-- ISO time the cron wrote it. Written only by src/db/public-stats.ts. No FKs, no personal data.
CREATE TABLE public_stats (
  key         TEXT NOT NULL PRIMARY KEY CHECK (length(key) BETWEEN 1 AND 64),
  value       TEXT NOT NULL CHECK (json_valid(value)),
  computed_at TEXT NOT NULL CHECK (computed_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*')
) WITHOUT ROWID;
