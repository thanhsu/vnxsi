-- Contact form: questions, suggestions and partnership offers sent to the VNX.SI team (plan VNX-0710). Additive only.
-- 0008 belongs to the M6 branch (requests); this file is 0009 so both can merge in either order.
-- Written only by src/db/feedback.ts (module `contact`).
CREATE TABLE feedback (
  id          TEXT PRIMARY KEY,                -- ULID
  role        TEXT NOT NULL CHECK (role IN ('builder', 'client', 'other')),
  kind        TEXT NOT NULL CHECK (kind IN ('question', 'suggestion', 'partnership', 'other')),
  name        TEXT,                            -- optional, at most 100 characters
  email       TEXT NOT NULL CHECK (email = lower(email)),
  message     TEXT NOT NULL,                   -- 20 to 2000 characters after CRLF -> LF
  locale      TEXT NOT NULL,
  user_id     TEXT REFERENCES users (id),      -- set when the sender was signed in
  status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'handled', 'spam')),
  notified_at TEXT,                            -- null = the e-mail to contact@vnx.si has not been sent
  handled_at  TEXT,
  handled_by  TEXT REFERENCES users (id),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX idx_feedback_status_created ON feedback (status, created_at);
