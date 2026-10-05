-- EPIC 21 feature flags (addendum §3.1). Additive only.
-- `key` has no CHECK on purpose: the list of valid keys is an enum in code (domain/flags.ts), so a new flag needs no migration.
-- A missing row means the flag is off.
CREATE TABLE feature_flags (
  key        TEXT PRIMARY KEY,
  enabled    INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  updated_by TEXT REFERENCES users (id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL,
  -- Random id of the last write; the audit row of that write is guarded on it (see setFlag).
  write_id   TEXT
);
