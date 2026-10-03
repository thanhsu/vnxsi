-- Wave 1 identity (spec §6.1). Additive only.
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  display_name  TEXT,
  locale        TEXT NOT NULL DEFAULT 'en',
  is_admin      INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  last_login_at TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE login_tokens (
  token_hash       TEXT PRIMARY KEY,
  email            TEXT NOT NULL,
  purpose          TEXT NOT NULL CHECK (purpose IN ('login', 'inquiry_verify', 'request_verify')),
  locale           TEXT NOT NULL DEFAULT 'en',
  inquiry_id       TEXT,
  request_id       TEXT,
  invite_code_hash TEXT,
  expires_at       TEXT NOT NULL,
  used_at          TEXT,
  created_at       TEXT NOT NULL
);
CREATE INDEX idx_login_tokens_expires ON login_tokens (expires_at);

CREATE TABLE sessions (
  id_hash    TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users (id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions (user_id);

CREATE TABLE rate_limits (
  key          TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL,
  PRIMARY KEY (key, window_start)
);

CREATE TABLE audit_log (
  id            TEXT PRIMARY KEY,
  actor_user_id TEXT,
  action        TEXT NOT NULL,
  entity        TEXT NOT NULL,
  entity_id     TEXT,
  data          TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL
);
CREATE INDEX idx_audit_entity ON audit_log (entity, entity_id);
