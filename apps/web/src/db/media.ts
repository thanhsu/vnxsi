import { MAX_MEDIA, type ProductMedia } from "../domain/product.ts";
import { ulid } from "../lib/ulid.ts";

type Row = { id: string; product_id: string; r2_key: string; alt: string; sort: number };

const toMedia = (r: Row): ProductMedia => ({ id: r.id, productId: r.product_id, r2Key: r.r2_key, alt: r.alt, sort: r.sort });

export async function listMedia(db: D1Database, productId: string): Promise<ProductMedia[]> {
  const { results } = await db.prepare("SELECT * FROM product_media WHERE product_id = ?1 ORDER BY sort, id").bind(productId).all<Row>();
  return results.map(toMedia);
}

export async function findMedia(db: D1Database, productId: string, id: string): Promise<ProductMedia | null> {
  const row = await db.prepare("SELECT * FROM product_media WHERE id = ?1 AND product_id = ?2").bind(id, productId).first<Row>();
  return row ? toMedia(row) : null;
}

/** Appends an image row; null when the product already has MAX_MEDIA (checked in the same statement). */
export async function addMedia(db: D1Database, input: { productId: string; r2Key: string; alt: string; now: string }): Promise<ProductMedia | null> {
  const id = ulid(Date.parse(input.now));
  const res = await db
    .prepare(
      `INSERT INTO product_media (id, product_id, r2_key, alt, sort, created_at)
       SELECT ?1, ?2, ?3, ?4, (SELECT COALESCE(MAX(sort), 0) + 1 FROM product_media WHERE product_id = ?2), ?5
       WHERE (SELECT COUNT(*) FROM product_media WHERE product_id = ?2) < ?6`,
    )
    .bind(id, input.productId, input.r2Key, input.alt, input.now, MAX_MEDIA)
    .run();
  return res.meta.changes === 1 ? findMedia(db, input.productId, id) : null;
}

export async function deleteMedia(db: D1Database, productId: string, id: string): Promise<boolean> {
  const res = await db.prepare("DELETE FROM product_media WHERE id = ?1 AND product_id = ?2").bind(id, productId).run();
  return res.meta.changes === 1;
}
