-- Ops console membership (plan O1, VNX-2501; spec §3.3, ADR-010). Additive only. Module `ops` (src/db/ops-members.ts) owns both tables.
-- No `owner` role here: the Owner comes only from ADMIN_EMAILS, so no row can grant or demote a root Owner.
-- An invitation grants nothing until its addressee signs in by magic link with that e-mail; it lasts 7 days (Owner 2026-10-05).
CREATE TABLE ops_members (
  user_id    TEXT PRIMARY KEY REFERENCES users (id),
  role       TEXT NOT NULL CHECK (role IN ('operator', 'content', 'viewer')),
  granted_by TEXT NOT NULL REFERENCES users (id),
  granted_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE ops_member_invites (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL CHECK (email = lower(email)),
  role        TEXT NOT NULL CHECK (role IN ('operator', 'content', 'viewer')),
  created_by  TEXT NOT NULL REFERENCES users (id),
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'cancelled', 'expired')),
  expires_at  TEXT NOT NULL,          -- created_at + 7 days
  accepted_by TEXT REFERENCES users (id),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
-- At most one pending invitation per e-mail.
CREATE UNIQUE INDEX uq_ops_invite_pending ON ops_member_invites (email) WHERE status = 'pending';
