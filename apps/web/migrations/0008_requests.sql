-- Wave 1 requests (spec §5.7, §6.1, §7.5, §7.6). Additive only.
-- Additions to spec §6.1 (plan M6): requests.client_name (the name builders see; never the e-mail), created_at /
-- updated_at on both tables (compare-and-set markers).
CREATE TABLE requests (
  id                 TEXT PRIMARY KEY,
  client_user_id     TEXT NOT NULL REFERENCES users (id),
  client_name        TEXT NOT NULL,
  title              TEXT NOT NULL,
  description        TEXT NOT NULL,
  category           TEXT NOT NULL
                     CHECK (category IN ('booking', 'crm', 'ecommerce', 'finance', 'hr', 'education', 'internal_tools', 'ai_agents', 'other')),
  budget_band        TEXT NOT NULL CHECK (budget_band IN ('<500', '500-2k', '2k-10k', '>10k', 'unsure')),
  deadline           TEXT,
  languages          TEXT NOT NULL DEFAULT '[]',
  status             TEXT NOT NULL
                     CHECK (status IN ('pending_verification', 'submitted', 'matching', 'builder_selected', 'rejected', 'expired', 'closed', 'removed')),
  locale             TEXT NOT NULL DEFAULT 'en',
  admin_note         TEXT,
  selected_invite_id TEXT,
  submitted_at       TEXT,
  matched_at         TEXT,
  closed_at          TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);
CREATE INDEX idx_requests_status ON requests (status, submitted_at);
CREATE INDEX idx_requests_client ON requests (client_user_id);

CREATE TABLE request_invites (
  id              TEXT PRIMARY KEY,
  request_id      TEXT NOT NULL REFERENCES requests (id),
  builder_id      TEXT NOT NULL REFERENCES builders (user_id),
  invited_by      TEXT NOT NULL REFERENCES users (id),
  status          TEXT NOT NULL CHECK (status IN ('invited', 'proposed', 'selected', 'not_selected', 'declined', 'expired')),
  approach        TEXT,
  price_cents     INTEGER CHECK (price_cents IS NULL OR price_cents > 0),
  price_max_cents INTEGER CHECK (price_max_cents IS NULL OR (price_cents IS NOT NULL AND price_max_cents > price_cents)),
  price_note      TEXT,
  timeline_days   INTEGER CHECK (timeline_days IS NULL OR timeline_days BETWEEN 1 AND 365),
  decline_reason  TEXT,
  invited_at      TEXT NOT NULL,
  responded_at    TEXT,
  reminded_at     TEXT,
  inquiry_id      TEXT REFERENCES inquiries (id),
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  UNIQUE (request_id, builder_id)
);
CREATE INDEX idx_request_invites_builder ON request_invites (builder_id, status);
CREATE INDEX idx_request_invites_request ON request_invites (request_id);
