-- EPIC 26 linked accounts (ADR-012 §2). Additive only. Module `identity` (src/db/identities.ts) owns user_identities.
-- No token column on purpose: access and refresh tokens are used inside one callback request and never stored (ADR-012 §1).
CREATE TABLE user_identities (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users (id),
  provider         TEXT NOT NULL CHECK (provider IN ('google', 'github', 'linkedin')),
  -- Immutable provider id: `sub` for Google and LinkedIn, the numeric `id` for GitHub (never `login`, which can change).
  provider_subject TEXT NOT NULL CHECK (length(provider_subject) BETWEEN 1 AND 255),
  -- E-mail (Google, LinkedIn) or login (GitHub). Shown only to the account owner, except a GitHub login on an opted-in badge.
  label            TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 254),
  show_on_profile  INTEGER NOT NULL DEFAULT 0 CHECK (show_on_profile IN (0, 1)),
  linked_at        TEXT NOT NULL,
  last_used_at     TEXT,
  updated_at       TEXT NOT NULL,
  -- One provider account belongs to one user; one user has at most one account per provider.
  UNIQUE (provider, provider_subject),
  UNIQUE (user_id, provider)
);

-- How a session was created. Existing sessions keep their meaning (they all came from a magic link). /ops and /admin accept only 'magic_link'.
ALTER TABLE sessions ADD COLUMN method TEXT NOT NULL DEFAULT 'magic_link'
  CHECK (method IN ('magic_link', 'oauth_google', 'oauth_github', 'oauth_linkedin'));
