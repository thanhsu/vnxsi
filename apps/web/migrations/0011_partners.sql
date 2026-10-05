-- EPIC 21 partners (addendum §3.2). Additive only: three new tables, nothing existing is changed.
-- Terms are never defaulted (ADR-007 rule 5): commission, cookie and currency columns may be NULL.
-- No DEFAULT anywhere: every value is chosen by the db module. Foreign keys keep the default NO ACTION: nothing cascades.
-- `write_id` is the random id of the last write; the audit row of that write is guarded on it (see AuditPartnerGuard).
-- No FK on merchants.default_offer_id (a cycle with offers) or offers.subject_id (polymorphic): the db modules check them.
CREATE TABLE merchants (
  id               TEXT PRIMARY KEY,
  slug             TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  website_url      TEXT NOT NULL,
  -- JSON array of host names (domain/offer-url.ts#isPublicHostname); read through parseStoredHosts.
  allowed_hosts    TEXT NOT NULL CHECK (json_valid(allowed_hosts)),
  logo_key         TEXT,
  description      TEXT NOT NULL,
  default_offer_id TEXT,
  indexable        INTEGER NOT NULL CHECK (indexable IN (0, 1)),
  status           TEXT NOT NULL CHECK (status IN ('active', 'paused', 'archived')),
  write_id         TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE TABLE partner_programs (
  id                    TEXT PRIMARY KEY,
  merchant_id           TEXT NOT NULL REFERENCES merchants (id),
  name                  TEXT NOT NULL,
  type                  TEXT NOT NULL CHECK (type IN ('affiliate', 'referral', 'revenue_share', 'direct')),
  network               TEXT,
  provider              TEXT NOT NULL CHECK (provider IN ('generic_template', 'manual')),
  commission_model      TEXT CHECK (commission_model IS NULL OR commission_model IN ('percent', 'flat', 'tiered', 'custom')),
  commission_rate_bps   INTEGER,
  commission_flat_minor INTEGER,
  currency              TEXT,
  cookie_days           INTEGER,
  attribution_notes     TEXT,
  terms_url             TEXT,
  terms_verified_at     TEXT,
  status                TEXT NOT NULL CHECK (status IN ('draft', 'active', 'paused', 'ended')),
  write_id              TEXT NOT NULL,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  -- ADR-007 rule 5, and the slice rule that `direct` has no flag so it can never be active (also checked in domain/offer.ts).
  CHECK (status != 'active' OR (terms_url IS NOT NULL AND terms_url <> '' AND terms_verified_at IS NOT NULL AND terms_verified_at <> '' AND type != 'direct'))
);
CREATE INDEX idx_programs_merchant ON partner_programs (merchant_id, status);

CREATE TABLE offers (
  id                TEXT PRIMARY KEY,
  -- NULL = an offer that earns nothing (the merchant's own link).
  program_id        TEXT REFERENCES partner_programs (id),
  subject_type      TEXT NOT NULL CHECK (subject_type IN ('product', 'merchant', 'article')),
  subject_id        TEXT NOT NULL,
  kind              TEXT NOT NULL CHECK (kind IN ('official', 'trial', 'affiliate', 'referral', 'sponsored')),
  label             TEXT NOT NULL CHECK (label IN ('learn_more', 'get_started', 'start_trial', 'visit_site', 'try_it')),
  destination_url   TEXT NOT NULL,
  tracking_template TEXT,
  status            TEXT NOT NULL CHECK (status IN ('active', 'paused', 'archived')),
  starts_at         TEXT,
  ends_at           TEXT,
  write_id          TEXT NOT NULL,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  -- An offer with a program needs a real template: NULL and the empty string are both refused.
  CHECK (program_id IS NULL OR (tracking_template IS NOT NULL AND tracking_template <> ''))
);
CREATE INDEX idx_offers_subject ON offers (subject_type, subject_id, status);
CREATE INDEX idx_offers_program ON offers (program_id);
