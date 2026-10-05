import type { MerchantInput, MerchantStatus } from "../domain/merchant.ts";
import { isPublicHostname } from "../domain/offer-url.ts";
import { ulid } from "../lib/ulid.ts";
import { runAudited } from "./audit.ts";

/** The only writer of `merchants` (module `monetization`, addendum §3.2). */

export type Merchant = {
  id: string;
  slug: string;
  name: string;
  websiteUrl: string;
  allowedHosts: string[];
  logoKey: string | null;
  description: string;
  defaultOfferId: string | null;
  indexable: boolean;
  status: MerchantStatus;
  createdAt: string;
  updatedAt: string;
};

type Row = {
  id: string;
  slug: string;
  name: string;
  website_url: string;
  allowed_hosts: string;
  logo_key: string | null;
  description: string;
  default_offer_id: string | null;
  indexable: number;
  status: MerchantStatus;
  write_id: string;
  created_at: string;
  updated_at: string;
};

/**
 * The stored JSON array, keeping only entries that are public host names (`isPublicHostname`). Anything else (not JSON, not an
 * array, an IP, an upper-case name) is dropped, so a damaged row can only shrink the allow-list, never widen it.
 */
export function parseStoredHosts(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((h): h is string => typeof h === "string" && isPublicHostname(h)) : [];
  } catch {
    return [];
  }
}

export const toMerchant = (r: Row): Merchant => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  websiteUrl: r.website_url,
  allowedHosts: parseStoredHosts(r.allowed_hosts),
  logoKey: r.logo_key,
  description: r.description,
  defaultOfferId: r.default_offer_id,
  indexable: r.indexable === 1,
  status: r.status,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

type Actor = { actorUserId: string; now: string };

/** The slug is taken: nothing is written (no row, no audit row). `status` is the caller's choice: the db has no default. */
export async function createMerchant(
  db: D1Database,
  input: Actor & { merchant: MerchantInput; status: MerchantStatus },
): Promise<{ ok: true; merchant: Merchant } | { ok: false; reason: "slug_taken" }> {
  const id = ulid(Date.parse(input.now));
  const writeId = ulid();
  const m = input.merchant;
  const row = await runAudited<Row>(
    db,
    db
      .prepare(
        `INSERT INTO merchants (id, slug, name, website_url, allowed_hosts, description, indexable, status, write_id, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)
         ON CONFLICT(slug) DO NOTHING
         RETURNING *`,
      )
      .bind(id, m.slug, m.name, m.websiteUrl, JSON.stringify(m.allowedHosts), m.description, m.indexable ? 1 : 0, input.status, writeId, input.now),
    { actorUserId: input.actorUserId, action: "merchant.create", entity: "merchant", entityId: id, data: { slug: m.slug }, now: input.now },
    { partnerTable: "merchants", id, writeId },
  );
  return row ? { ok: true, merchant: toMerchant(row) } : { ok: false, reason: "slug_taken" };
}

/** Every editable field except `slug` (shared links) and `status` (use setMerchantStatus). Null when there is no such merchant. */
export async function updateMerchant(db: D1Database, input: Actor & { id: string; merchant: Omit<MerchantInput, "slug"> }): Promise<Merchant | null> {
  const writeId = ulid();
  const m = input.merchant;
  const row = await runAudited<Row>(
    db,
    db
      .prepare(
        `UPDATE merchants SET name = ?2, website_url = ?3, allowed_hosts = ?4, description = ?5, indexable = ?6, write_id = ?7, updated_at = ?8
         WHERE id = ?1
         RETURNING *`,
      )
      .bind(input.id, m.name, m.websiteUrl, JSON.stringify(m.allowedHosts), m.description, m.indexable ? 1 : 0, writeId, input.now),
    { actorUserId: input.actorUserId, action: "merchant.update", entity: "merchant", entityId: input.id, now: input.now },
    { partnerTable: "merchants", id: input.id, writeId },
  );
  return row ? toMerchant(row) : null;
}

/**
 * Compare-and-set: changes the merchant only while it is still in `from`; null otherwise (nothing written, nothing audited). `archived` is
 * terminal and `from === to` is not a change, so both also return null.
 */
export async function setMerchantStatus(db: D1Database, input: Actor & { id: string; from: MerchantStatus; to: MerchantStatus }): Promise<Merchant | null> {
  const writeId = ulid();
  const row = await runAudited<Row>(
    db,
    db
      .prepare("UPDATE merchants SET status = ?3, write_id = ?4, updated_at = ?5 WHERE id = ?1 AND status = ?2 AND ?2 <> ?3 AND ?2 <> 'archived' RETURNING *")
      .bind(input.id, input.from, input.to, writeId, input.now),
    { actorUserId: input.actorUserId, action: "merchant.status", entity: "merchant", entityId: input.id, data: { from: input.from, to: input.to }, now: input.now },
    { partnerTable: "merchants", id: input.id, writeId },
  );
  return row ? toMerchant(row) : null;
}

export async function findMerchantById(db: D1Database, id: string): Promise<Merchant | null> {
  const row = await db.prepare("SELECT * FROM merchants WHERE id = ?1").bind(id).first<Row>();
  return row ? toMerchant(row) : null;
}

/** For /admin/merchants: every merchant, by name. */
export async function listMerchants(db: D1Database): Promise<Merchant[]> {
  const { results } = await db.prepare("SELECT * FROM merchants ORDER BY name COLLATE NOCASE, id").all<Row>();
  return results.map(toMerchant);
}
