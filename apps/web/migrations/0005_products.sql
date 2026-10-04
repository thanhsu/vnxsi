-- Wave 1 products (spec §6.1, §7.2). Additive only. products_fts arrives with M4 (VNX-0401).
CREATE TABLE products (
  id                      TEXT PRIMARY KEY,
  builder_id              TEXT NOT NULL REFERENCES builders (user_id),
  slug                    TEXT NOT NULL UNIQUE,
  status                  TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'in_review', 'changes_requested', 'published', 'unlisted', 'suspended', 'archived')),
  primary_lang            TEXT NOT NULL DEFAULT 'en' CHECK (primary_lang IN ('en', 'vi', 'zh-Hans', 'zh-Hant')),
  name                    TEXT NOT NULL,
  tagline                 TEXT NOT NULL DEFAULT '',
  problem                 TEXT NOT NULL DEFAULT '',
  target_users            TEXT NOT NULL DEFAULT '',
  description             TEXT NOT NULL DEFAULT '',
  category                TEXT CHECK (category IS NULL OR category IN ('booking', 'crm', 'ecommerce', 'finance', 'hr', 'education', 'internal_tools', 'ai_agents', 'other')),
  tags                    TEXT NOT NULL DEFAULT '[]',
  features                TEXT NOT NULL DEFAULT '[]',
  tech_stack              TEXT NOT NULL DEFAULT '[]',
  delivery_model          TEXT CHECK (delivery_model IS NULL OR delivery_model IN ('saas', 'source', 'service')),
  license                 TEXT CHECK (license IS NULL OR license IN ('single_use', 'extended', 'open_source')),
  demo_url                TEXT,
  website_url             TEXT,
  customizable            INTEGER NOT NULL DEFAULT 0 CHECK (customizable IN (0, 1)),
  customization_notes     TEXT NOT NULL DEFAULT '',
  support_policy          TEXT NOT NULL DEFAULT '',
  review_note             TEXT,
  first_published_at      TEXT,
  published_at            TEXT,
  edited_after_publish_at TEXT,
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL
);
CREATE INDEX idx_products_status_published ON products (status, published_at);
CREATE INDEX idx_products_builder ON products (builder_id);
CREATE INDEX idx_products_category_status ON products (category, status);

CREATE TABLE pricing_tiers (
  id          TEXT PRIMARY KEY,
  product_id  TEXT NOT NULL REFERENCES products (id),
  name        TEXT NOT NULL,
  price_cents INTEGER CHECK (price_cents IS NULL OR price_cents >= 0),
  billing     TEXT NOT NULL CHECK (billing IN ('one_time', 'monthly', 'yearly', 'contact')),
  description TEXT NOT NULL DEFAULT '',
  sort        INTEGER NOT NULL,
  created_at  TEXT NOT NULL,
  CHECK ((billing = 'contact') = (price_cents IS NULL))
);
CREATE INDEX idx_tiers_product ON pricing_tiers (product_id, sort);

CREATE TABLE product_media (
  id         TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products (id),
  r2_key     TEXT NOT NULL UNIQUE,
  alt        TEXT NOT NULL DEFAULT '',
  sort       INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_media_product ON product_media (product_id, sort);

CREATE TABLE product_verifications (
  id            TEXT PRIMARY KEY,
  product_id    TEXT NOT NULL REFERENCES products (id),
  kind          TEXT NOT NULL CHECK (kind IN ('listed', 'demo_verified', 'in_production')),
  verified_by   TEXT REFERENCES users (id),
  evidence      TEXT NOT NULL DEFAULT '',
  verified_at   TEXT NOT NULL,
  revoked_at    TEXT,
  revoke_reason TEXT
);
CREATE INDEX idx_verifications_product ON product_verifications (product_id);
-- At most one active badge of each kind per product.
CREATE UNIQUE INDEX uq_verifications_active ON product_verifications (product_id, kind) WHERE revoked_at IS NULL;
