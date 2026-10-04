import type { Product, ProductStatus } from "../domain/product.ts";
import { slugify, slugWithSuffix } from "../domain/slug.ts";
import { ulid } from "../lib/ulid.ts";

export type ProductRow = {
  id: string;
  builder_id: string;
  slug: string;
  status: ProductStatus;
  primary_lang: Product["primaryLang"];
  name: string;
  tagline: string;
  problem: string;
  target_users: string;
  description: string;
  category: Product["category"];
  tags: string;
  features: string;
  tech_stack: string;
  delivery_model: Product["deliveryModel"];
  license: Product["license"];
  demo_url: string | null;
  website_url: string | null;
  customizable: number;
  customization_notes: string;
  support_policy: string;
  review_note: string | null;
  first_published_at: string | null;
  published_at: string | null;
  edited_after_publish_at: string | null;
  created_at: string;
  updated_at: string;
};

function jsonList(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function toProduct(r: ProductRow): Product {
  return {
    id: r.id,
    builderId: r.builder_id,
    slug: r.slug,
    status: r.status,
    primaryLang: r.primary_lang,
    name: r.name,
    tagline: r.tagline,
    problem: r.problem,
    targetUsers: r.target_users,
    description: r.description,
    category: r.category,
    tags: jsonList(r.tags),
    features: jsonList(r.features),
    techStack: jsonList(r.tech_stack),
    deliveryModel: r.delivery_model,
    license: r.license,
    demoUrl: r.demo_url,
    websiteUrl: r.website_url,
    customizable: r.customizable === 1,
    customizationNotes: r.customization_notes,
    supportPolicy: r.support_policy,
    reviewNote: r.review_note,
    firstPublishedAt: r.first_published_at,
    publishedAt: r.published_at,
    editedAfterPublishAt: r.edited_after_publish_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function randomSuffix(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  return [...crypto.getRandomValues(new Uint8Array(4))].map((b) => alphabet[b % alphabet.length]).join("");
}

/** New draft; the slug comes from the name and gets a random suffix when taken. */
export async function createProductDraft(db: D1Database, input: { builderId: string; name: string; now: string }): Promise<Product> {
  const id = ulid(Date.parse(input.now));
  const base = slugify(input.name);
  for (let attempt = 0; attempt < 4; attempt++) {
    const slug = attempt === 0 ? base : slugWithSuffix(base, randomSuffix());
    try {
      await db
        .prepare("INSERT INTO products (id, builder_id, slug, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)")
        .bind(id, input.builderId, slug, input.name, input.now)
        .run();
      const product = await findProductById(db, id);
      if (!product) throw new Error("product insert failed");
      return product;
    } catch (err) {
      if (!String(err).includes("products.slug")) throw err;
    }
  }
  throw new Error("could not allocate a product slug");
}

export async function findProductById(db: D1Database, id: string): Promise<Product | null> {
  const row = await db.prepare("SELECT * FROM products WHERE id = ?1").bind(id).first<ProductRow>();
  return row ? toProduct(row) : null;
}

/** The product only if `builderId` owns it; anything else reads as missing. */
export async function findOwnedProduct(db: D1Database, builderId: string, id: string): Promise<Product | null> {
  const row = await db.prepare("SELECT * FROM products WHERE id = ?1 AND builder_id = ?2").bind(id, builderId).first<ProductRow>();
  return row ? toProduct(row) : null;
}

/** The builder's products except archived ones, most recently changed first. */
export async function listBuilderProducts(db: D1Database, builderId: string): Promise<Product[]> {
  const { results } = await db
    .prepare("SELECT * FROM products WHERE builder_id = ?1 AND status != 'archived' ORDER BY updated_at DESC, id DESC")
    .bind(builderId)
    .all<ProductRow>();
  return results.map(toProduct);
}

/** Compare-and-set on status. Publishing stamps published_at and, the first time, first_published_at. */
export async function setProductStatus(
  db: D1Database,
  input: { id: string; from: ProductStatus; to: ProductStatus; reviewNote: string | null; now: string },
): Promise<Product | null> {
  const row = await db
    .prepare(
      `UPDATE products SET status = ?3, review_note = ?4, updated_at = ?5,
         published_at = CASE WHEN ?3 = 'published' THEN ?5 ELSE published_at END,
         first_published_at = CASE WHEN ?3 = 'published' THEN COALESCE(first_published_at, ?5) ELSE first_published_at END
       WHERE id = ?1 AND status = ?2
       RETURNING *`,
    )
    .bind(input.id, input.from, input.to, input.reviewNote, input.now)
    .first<ProductRow>();
  return row ? toProduct(row) : null;
}
