import { BADGE_SCORE, likePattern, PAGE_SIZE, searchPlan, type CatalogItem, type CatalogQuery, type Paged } from "../domain/catalog.ts";
import type { Category } from "../domain/product.ts";
import { PUBLIC_PRODUCT } from "./products.ts";

type ItemRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  category: Category | null;
  builder_handle: string;
  builder_name: string;
  cover_key: string | null;
  min_price_cents: number | null;
  badge_score: number;
};

const toItem = (r: ItemRow): CatalogItem => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  tagline: r.tagline,
  category: r.category,
  builderHandle: r.builder_handle,
  builderName: r.builder_name,
  coverKey: r.cover_key,
  minPriceCents: r.min_price_cents,
  badgeScore: r.badge_score,
});

// SQL is assembled only from these constants; user input is always bound.
const JOINS = "JOIN builders b ON b.user_id = p.builder_id JOIN users u ON u.id = p.builder_id";
const BADGE_SCORE_SQL = `COALESCE((SELECT MAX(CASE v.kind ${Object.entries(BADGE_SCORE)
  .map(([kind, score]) => `WHEN '${kind}' THEN ${score}`)
  .join(" ")} END) FROM product_verifications v WHERE v.product_id = p.id AND v.revoked_at IS NULL), 0)`;
const MIN_PRICE_SQL = "(SELECT MIN(t.price_cents) FROM pricing_tiers t WHERE t.product_id = p.id AND t.price_cents IS NOT NULL)";
const COVER_SQL = "(SELECT m.r2_key FROM product_media m WHERE m.product_id = p.id ORDER BY m.sort, m.id LIMIT 1)";

/** SQL condition: some element of the JSON list in `column` matches the bound LIKE `pattern` (never the raw JSON text). */
export function jsonListLike(column: string, pattern: string): string {
  return `EXISTS (SELECT 1 FROM json_each(CASE WHEN json_valid(${column}) THEN ${column} ELSE '[]' END) WHERE value LIKE ${pattern} ESCAPE '\\')`;
}

/**
 * Spec §8.7 search over public products: FTS5 trigram (bm25) for terms of 3+ characters, LIKE for shorter ones,
 * then the highest active badge, then the newest approval. ADR-004: no other input reaches the order.
 */
export async function searchProducts(db: D1Database, query: CatalogQuery): Promise<Paged<CatalogItem>> {
  const plan = searchPlan(query.q);
  const params: (string | number)[] = [];
  const bind = (value: string | number) => {
    params.push(value);
    return `?${params.length}`;
  };

  const fts = plan.mode === "fts";
  const hits = fts ? `WITH hits AS (SELECT product_id, bm25(products_fts) AS rank FROM products_fts WHERE products_fts MATCH ${bind(plan.match)}) ` : "";
  const from = fts ? `hits JOIN products p ON p.id = hits.product_id ${JOINS}` : `products p ${JOINS}`;

  const where = [PUBLIC_PRODUCT];
  for (const term of plan.mode === "browse" ? [] : plan.likeTerms) {
    const pattern = bind(likePattern(term));
    where.push(`(p.name LIKE ${pattern} ESCAPE '\\' OR p.tagline LIKE ${pattern} ESCAPE '\\' OR ${jsonListLike("p.tags", pattern)})`);
  }
  if (query.category) where.push(`p.category = ${bind(query.category)}`);
  if (query.delivery) where.push(`p.delivery_model = ${bind(query.delivery)}`);
  if (query.lang) where.push(`p.primary_lang = ${bind(query.lang)}`);
  if (query.badge) where.push(`EXISTS (SELECT 1 FROM product_verifications v WHERE v.product_id = p.id AND v.kind = ${bind(query.badge)} AND v.revoked_at IS NULL)`);
  if (query.minCents !== null) where.push(`${MIN_PRICE_SQL} >= ${bind(query.minCents)}`);
  if (query.maxCents !== null) where.push(`${MIN_PRICE_SQL} <= ${bind(query.maxCents)}`);
  const filter = where.join(" AND ");

  const order = [...(fts ? ["hits.rank"] : []), "badge_score DESC", "p.published_at DESC", "p.id DESC"].join(", ");
  // page comes from parsePage (an integer 1–9999), so LIMIT/OFFSET are literals; binding them would give the
  // count statement more parameters than it uses.
  const offset = (query.page - 1) * PAGE_SIZE;
  const list = db
    .prepare(
      `${hits}SELECT p.id, p.slug, p.name, p.tagline, p.category, b.handle AS builder_handle, b.name AS builder_name,
         ${COVER_SQL} AS cover_key, ${MIN_PRICE_SQL} AS min_price_cents, ${BADGE_SCORE_SQL} AS badge_score
       FROM ${from} WHERE ${filter} ORDER BY ${order} LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
    )
    .bind(...params);
  const count = db.prepare(`${hits}SELECT COUNT(*) AS n FROM ${from} WHERE ${filter}`).bind(...params);
  const [rows, total] = await db.batch([list, count]);
  return { items: ((rows?.results ?? []) as ItemRow[]).map(toItem), total: (total?.results[0] as { n: number } | undefined)?.n ?? 0 };
}
