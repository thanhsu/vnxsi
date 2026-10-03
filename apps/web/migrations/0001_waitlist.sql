-- Waitlist for the Coming Soon phase (plan §21–22).
CREATE TABLE IF NOT EXISTS waitlist (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT    NOT NULL UNIQUE,
  personas    TEXT    NOT NULL DEFAULT '[]',  -- JSON array: user | business | developer | partner
  message     TEXT,
  spend_band  TEXT,                           -- monthly AI/API spend: none | lt1m | 1-10m | 10-50m | gt50m
  consent_at  TEXT    NOT NULL,               -- PDPL: explicit consent timestamp (ISO 8601)
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL,
  referrer    TEXT,
  utm_source  TEXT,
  utm_medium  TEXT,
  utm_campaign TEXT,
  country     TEXT
);

CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist (created_at);
