-- Wave 1 inquiries (spec §5.6, §6.1, §7.3). Additive only.
-- Additions to spec §6.1 (plan M5): inquiries.client_name (the name the builder sees; never the e-mail),
-- inquiries.opened_at (start of the 3/7-day timers), inquiry_messages.kind ('decline' = the builder declined, body is
-- the optional reason), inquiry_messages.notify_attempts (spec §8.3: at most 3 sends).
CREATE TABLE inquiries (
  id                  TEXT PRIMARY KEY,
  client_user_id      TEXT NOT NULL REFERENCES users (id),
  client_name         TEXT NOT NULL,
  builder_id          TEXT NOT NULL REFERENCES builders (user_id),
  product_id          TEXT REFERENCES products (id),
  request_id          TEXT,
  type                TEXT NOT NULL CHECK (type IN ('buy', 'customize', 'hire', 'build_similar', 'request')),
  message             TEXT NOT NULL,
  budget_band         TEXT NOT NULL CHECK (budget_band IN ('<500', '500-2k', '2k-10k', '>10k', 'unsure')),
  deadline            TEXT,
  status              TEXT NOT NULL
                      CHECK (status IN ('pending_verification', 'open', 'answered', 'declined', 'closed', 'removed')),
  locale              TEXT NOT NULL DEFAULT 'en',
  opened_at           TEXT,
  last_activity_at    TEXT NOT NULL,
  builder_reminded_at TEXT,
  admin_alerted_at    TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  -- Spec §5.6: a builder cannot send an inquiry to themself.
  CHECK (client_user_id != builder_id)
);
CREATE INDEX idx_inquiries_builder ON inquiries (builder_id, status);
CREATE INDEX idx_inquiries_client ON inquiries (client_user_id);
CREATE INDEX idx_inquiries_status_opened ON inquiries (status, opened_at);

CREATE TABLE inquiry_messages (
  id              TEXT PRIMARY KEY,
  inquiry_id      TEXT NOT NULL REFERENCES inquiries (id),
  sender_user_id  TEXT NOT NULL REFERENCES users (id),
  kind            TEXT NOT NULL DEFAULT 'message' CHECK (kind IN ('message', 'decline')),
  body            TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  notified_at     TEXT,
  notify_attempts INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_inquiry_messages_inquiry ON inquiry_messages (inquiry_id, created_at);
CREATE INDEX idx_inquiry_messages_unnotified ON inquiry_messages (created_at) WHERE notified_at IS NULL;
