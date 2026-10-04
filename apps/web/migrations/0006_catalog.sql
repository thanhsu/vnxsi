-- M4 catalogue search (spec §6.1 products_fts, §8.7). Additive only.
-- Holds published products only. The rest of the public rule (approved builder, active user) is applied by the query,
-- so suspending a builder needs no index change. Triggers keep it in sync on every write path; nothing in src/ writes it.
-- product_id is UNINDEXED, so deleting by it scans the index: fine at Wave 1 scale (hundreds of products).
CREATE VIRTUAL TABLE products_fts USING fts5(
  product_id UNINDEXED,
  name,
  tagline,
  description,
  tags,
  tokenize = 'trigram'
);

CREATE TRIGGER products_fts_after_insert AFTER INSERT ON products WHEN new.status = 'published' BEGIN
  INSERT INTO products_fts (product_id, name, tagline, description, tags)
  VALUES (
    new.id, new.name, new.tagline, new.description,
    CASE WHEN json_valid(new.tags) THEN (SELECT COALESCE(group_concat(value, ' '), '') FROM json_each(new.tags)) ELSE '' END
  );
END;

CREATE TRIGGER products_fts_after_update AFTER UPDATE OF status, name, tagline, description, tags ON products
WHEN old.status = 'published' OR new.status = 'published' BEGIN
  DELETE FROM products_fts WHERE product_id = old.id;
  INSERT INTO products_fts (product_id, name, tagline, description, tags)
  SELECT
    new.id, new.name, new.tagline, new.description,
    CASE WHEN json_valid(new.tags) THEN (SELECT COALESCE(group_concat(value, ' '), '') FROM json_each(new.tags)) ELSE '' END
  WHERE new.status = 'published';
END;

CREATE TRIGGER products_fts_after_delete AFTER DELETE ON products WHEN old.status = 'published' BEGIN
  DELETE FROM products_fts WHERE product_id = old.id;
END;

-- Backfill products published before this migration.
INSERT INTO products_fts (product_id, name, tagline, description, tags)
SELECT
  id, name, tagline, description,
  CASE WHEN json_valid(tags) THEN (SELECT COALESCE(group_concat(value, ' '), '') FROM json_each(tags)) ELSE '' END
FROM products
WHERE status = 'published';
