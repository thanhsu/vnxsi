-- EPIC 27 public request board (addendum §6). Additive only; no INSERT, so nothing is made public retroactively.
-- Module `matching` (src/db/request-board.ts) owns request_publications and request_interests.
ALTER TABLE requests ADD COLUMN country TEXT CHECK (country IS NULL OR length(country) = 2);

CREATE TABLE request_publications (
  request_id         TEXT PRIMARY KEY REFERENCES requests (id) ON DELETE CASCADE,
  public_id          TEXT NOT NULL UNIQUE,
  status             TEXT NOT NULL CHECK (status IN ('pending_review', 'published', 'rejected', 'withdrawn', 'unpublished')),
  public_title       TEXT CHECK (public_title IS NULL OR length(public_title) BETWEEN 1 AND 120),
  public_description TEXT CHECK (public_description IS NULL OR length(public_description) BETWEEN 40 AND 4000),
  opted_in_at        TEXT NOT NULL,
  consent_version    TEXT NOT NULL,
  reviewed_by        TEXT REFERENCES users (id),
  reviewed_at        TEXT,
  review_note        TEXT CHECK (review_note IS NULL OR length(review_note) <= 1000),
  published_at       TEXT,
  ended_at           TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  CHECK (status <> 'published' OR (public_title IS NOT NULL AND public_description IS NOT NULL AND published_at IS NOT NULL))
);
CREATE INDEX idx_request_publications_status ON request_publications (status, published_at);

CREATE TABLE request_interests (
  id          TEXT PRIMARY KEY,
  request_id  TEXT NOT NULL REFERENCES requests (id) ON DELETE CASCADE,
  builder_id  TEXT NOT NULL REFERENCES builders (user_id),
  note        TEXT CHECK (note IS NULL OR length(note) <= 500),
  product_id  TEXT REFERENCES products (id),
  status      TEXT NOT NULL CHECK (status IN ('pending', 'invited', 'dismissed', 'withdrawn')),
  decided_by  TEXT REFERENCES users (id),
  decided_at  TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  UNIQUE (request_id, builder_id)
);
CREATE INDEX idx_request_interests_request ON request_interests (request_id, status);
CREATE INDEX idx_request_interests_builder ON request_interests (builder_id, created_at);
