-- Wave 1 builders (spec §6.1, §7.1). Additive only.
CREATE TABLE invites (
  code_hash  TEXT PRIMARY KEY,
  created_by TEXT NOT NULL REFERENCES users (id),
  max_uses   INTEGER NOT NULL CHECK (max_uses BETWEEN 1 AND 1000),
  uses       INTEGER NOT NULL DEFAULT 0 CHECK (uses >= 0 AND uses <= max_uses),
  expires_at TEXT NOT NULL,
  note       TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE builders (
  user_id           TEXT PRIMARY KEY REFERENCES users (id),
  handle            TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  kind              TEXT NOT NULL CHECK (kind IN ('individual', 'team', 'company')),
  headline          TEXT NOT NULL,
  bio               TEXT NOT NULL,
  country           TEXT NOT NULL,
  website_url       TEXT,
  skills            TEXT NOT NULL DEFAULT '[]',
  ai_tools          TEXT NOT NULL DEFAULT '[]',
  work_languages    TEXT NOT NULL DEFAULT '[]',
  availability      TEXT NOT NULL CHECK (availability IN ('open', 'limited', 'closed')),
  hourly_rate_cents INTEGER CHECK (hourly_rate_cents IS NULL OR hourly_rate_cents > 0),
  status            TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  review_note       TEXT,
  invite_code_hash  TEXT,
  approved_at       TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX idx_builders_status ON builders (status, created_at);

CREATE TABLE portfolio_items (
  id          TEXT PRIMARY KEY,
  builder_id  TEXT NOT NULL REFERENCES builders (user_id),
  title       TEXT NOT NULL,
  url         TEXT,
  description TEXT NOT NULL DEFAULT '',
  image_key   TEXT,
  sort        INTEGER NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX idx_portfolio_builder ON portfolio_items (builder_id, sort);
