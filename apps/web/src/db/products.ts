import type { BuilderStatus } from "../domain/builder.ts";
import type { Product, ProductStatus, ProductWithBuilder } from "../domain/product.ts";
import type { ProductField, ProductFields } from "../domain/product-input.ts";
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

/**
 * "This request's compare-and-set on the product went through": the product is in `status` and was last written at
 * `updatedAt`. Statements batched after the compare-and-set use it so that a lost race (0 rows changed) writes nothing.
 */
export type ProductGuard = { productId: string; status: ProductStatus; updatedAt: string };

/** Compare-and-set on status, as a statement for db.batch. Publishing stamps published_at and, the first time, first_published_at. */
export function setProductStatusStatement(db: D1Database, input: { id: string; from: ProductStatus; to: ProductStatus; reviewNote: string | null; now: string }): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE products SET status = ?3, review_note = ?4, updated_at = ?5,
         published_at = CASE WHEN ?3 = 'published' THEN ?5 ELSE published_at END,
         first_published_at = CASE WHEN ?3 = 'published' THEN COALESCE(first_published_at, ?5) ELSE first_published_at END
       WHERE id = ?1 AND status = ?2
       RETURNING *`,
    )
    .bind(input.id, input.from, input.to, input.reviewNote, input.now);
}

/** The product a batched setProductStatusStatement returned, or null when its compare-and-set lost. */
export function returnedProduct(result: D1Result | undefined): Product | null {
  const row = result?.results[0] as ProductRow | undefined;
  return row ? toProduct(row) : null;
}

/** Compare-and-set on status. Publishing stamps published_at and, the first time, first_published_at. */
export async function setProductStatus(
  db: D1Database,
  input: { id: string; from: ProductStatus; to: ProductStatus; reviewNote: string | null; now: string },
): Promise<Product | null> {
  const row = await setProductStatusStatement(db, input).first<ProductRow>();
  return row ? toProduct(row) : null;
}

/** Fixed column names; SQL is built only from these constants, never from input. */
const COLUMN: Record<ProductField, string> = {
  name: "name",
  slug: "slug",
  tagline: "tagline",
  category: "category",
  deliveryModel: "delivery_model",
  primaryLang: "primary_lang",
  tags: "tags",
  description: "description",
  problem: "problem",
  targetUsers: "target_users",
  features: "features",
  techStack: "tech_stack",
  demoUrl: "demo_url",
  websiteUrl: "website_url",
  customizable: "customizable",
  customizationNotes: "customization_notes",
  license: "license",
  supportPolicy: "support_policy",
};

function encode(value: unknown): string | number | null {
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === "boolean") return value ? 1 : 0;
  return value as string | number | null;
}

export type UpdateFieldsResult = "ok" | "stale" | "slug_taken";

type UpdateFieldsInput = { productId: string; builderId: string; expectedStatus: Product["status"]; fields: Partial<ProductFields>; now: string; markEdited: boolean };

/**
 * Writes the given fields while the product is still owned by `builderId` and in `expectedStatus`, as a statement for
 * db.batch (0 rows changed = lost compare-and-set). `markEdited` stamps edited_after_publish_at (spec §7.2: edits after
 * the first publish go live and are flagged).
 */
export function updateProductFieldsStatement(db: D1Database, input: UpdateFieldsInput): D1PreparedStatement {
  const entries = Object.entries(input.fields).filter(([key]) => key in COLUMN) as [ProductField, unknown][];
  const params: (string | number | null)[] = [input.productId, input.builderId, input.expectedStatus, input.now, input.markEdited ? 1 : 0];
  const sets = entries.map(([key, value]) => {
    params.push(encode(value));
    return `${COLUMN[key]} = ?${params.length}`;
  });
  const sql = `UPDATE products SET ${[...sets, "updated_at = ?4", "edited_after_publish_at = CASE WHEN ?5 = 1 THEN ?4 ELSE edited_after_publish_at END"].join(", ")}
    WHERE id = ?1 AND builder_id = ?2 AND status = ?3`;
  return db.prepare(sql).bind(...params);
}

/** updateProductFieldsStatement run on its own; reports a taken slug instead of throwing. */
export async function updateProductFields(db: D1Database, input: UpdateFieldsInput): Promise<UpdateFieldsResult> {
  try {
    const res = await updateProductFieldsStatement(db, input).run();
    return res.meta.changes === 1 ? "ok" : "stale";
  } catch (err) {
    if (String(err).includes("products.slug")) return "slug_taken";
    throw err;
  }
}

/** Product counts per status for the Hub overview (archived excluded). */
export async function countBuilderProductsByStatus(db: D1Database, builderId: string): Promise<Partial<Record<ProductStatus, number>>> {
  const { results } = await db
    .prepare("SELECT status, COUNT(*) AS n FROM products WHERE builder_id = ?1 AND status != 'archived' GROUP BY status")
    .bind(builderId)
    .all<{ status: ProductStatus; n: number }>();
  return Object.fromEntries(results.map((r) => [r.status, r.n]));
}

type WithBuilderRow = ProductRow & { builder_handle: string; builder_name: string; builder_email: string; builder_locale: string; builder_status: BuilderStatus };

const WITH_BUILDER = `SELECT p.*, b.handle AS builder_handle, b.name AS builder_name, b.status AS builder_status, u.email AS builder_email, u.locale AS builder_locale
  FROM products p JOIN builders b ON b.user_id = p.builder_id JOIN users u ON u.id = p.builder_id`;

function toWithBuilder(r: WithBuilderRow): ProductWithBuilder {
  return { product: toProduct(r), builderHandle: r.builder_handle, builderName: r.builder_name, builderEmail: r.builder_email, builderLocale: r.builder_locale, builderStatus: r.builder_status };
}

export async function findProductWithBuilder(db: D1Database, id: string): Promise<ProductWithBuilder | null> {
  const row = await db.prepare(`${WITH_BUILDER} WHERE p.id = ?1`).bind(id).first<WithBuilderRow>();
  return row ? toWithBuilder(row) : null;
}

/** Oldest change first, so the review queue is first come, first served. */
export async function listProductsByStatus(db: D1Database, status: ProductStatus, limit = 200): Promise<ProductWithBuilder[]> {
  const { results } = await db.prepare(`${WITH_BUILDER} WHERE p.status = ?1 ORDER BY p.updated_at, p.id LIMIT ?2`).bind(status, limit).all<WithBuilderRow>();
  return results.map(toWithBuilder);
}

/** Spec §5.5 "Mới chỉnh sửa": published products edited since `since`, newest edit first. */
export async function listRecentlyEdited(db: D1Database, since: string, limit = 200): Promise<ProductWithBuilder[]> {
  const { results } = await db
    .prepare(`${WITH_BUILDER} WHERE p.status = 'published' AND p.edited_after_publish_at >= ?1 ORDER BY p.edited_after_publish_at DESC, p.id LIMIT ?2`)
    .bind(since, limit)
    .all<WithBuilderRow>();
  return results.map(toWithBuilder);
}

const PUBLIC = "p.status = 'published' AND b.status = 'approved' AND u.status = 'active'";

/** Spec §7.2: only published products of approved builders on active accounts are public. */
export async function findPublicProductBySlug(db: D1Database, slug: string): Promise<ProductWithBuilder | null> {
  const row = await db.prepare(`${WITH_BUILDER} WHERE p.slug = ?1 AND ${PUBLIC}`).bind(slug).first<WithBuilderRow>();
  return row ? toWithBuilder(row) : null;
}

export async function listPublicProductsByBuilder(db: D1Database, builderId: string): Promise<Product[]> {
  const { results } = await db.prepare(`${WITH_BUILDER} WHERE p.builder_id = ?1 AND ${PUBLIC} ORDER BY p.published_at DESC, p.id`).bind(builderId).all<WithBuilderRow>();
  return results.map(toProduct);
}
