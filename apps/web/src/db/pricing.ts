import type { TierInput } from "../domain/pricing-input.ts";
import type { PricingTier } from "../domain/product.ts";
import { ulid } from "../lib/ulid.ts";

type Row = { id: string; product_id: string; name: string; price_cents: number | null; billing: PricingTier["billing"]; description: string; sort: number };

const toTier = (r: Row): PricingTier => ({ id: r.id, productId: r.product_id, name: r.name, priceCents: r.price_cents, billing: r.billing, description: r.description, sort: r.sort });

export async function listTiers(db: D1Database, productId: string): Promise<PricingTier[]> {
  const { results } = await db.prepare("SELECT * FROM pricing_tiers WHERE product_id = ?1 ORDER BY sort, id").bind(productId).all<Row>();
  return results.map(toTier);
}

/** Replaces the whole set in one transaction (the form always posts every tier). */
export async function replaceTiers(db: D1Database, input: { productId: string; tiers: TierInput[]; now: string }): Promise<void> {
  const base = Date.parse(input.now);
  const insert = db.prepare("INSERT INTO pricing_tiers (id, product_id, name, price_cents, billing, description, sort, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)");
  await db.batch([
    db.prepare("DELETE FROM pricing_tiers WHERE product_id = ?1").bind(input.productId),
    ...input.tiers.map((t, i) => insert.bind(ulid(base + i), input.productId, t.name, t.priceCents, t.billing, t.description, i + 1, input.now)),
  ]);
}
