import type { CommissionModel, ProgramInput, ProgramProvider, ProgramStatus, ProgramType } from "../domain/offer.ts";
import { ulid } from "../lib/ulid.ts";
import { runAudited } from "./audit.ts";

/** The only writer of `partner_programs` (module `monetization`, addendum §3.2). */

export type PartnerProgram = {
  id: string;
  merchantId: string;
  name: string;
  type: ProgramType;
  network: string | null;
  provider: ProgramProvider;
  commissionModel: CommissionModel | null;
  commissionRateBps: number | null;
  commissionFlatMinor: number | null;
  currency: string | null;
  cookieDays: number | null;
  attributionNotes: string | null;
  termsUrl: string | null;
  termsVerifiedAt: string | null;
  status: ProgramStatus;
  createdAt: string;
  updatedAt: string;
};

type Row = {
  id: string;
  merchant_id: string;
  name: string;
  type: ProgramType;
  network: string | null;
  provider: ProgramProvider;
  commission_model: CommissionModel | null;
  commission_rate_bps: number | null;
  commission_flat_minor: number | null;
  currency: string | null;
  cookie_days: number | null;
  attribution_notes: string | null;
  terms_url: string | null;
  terms_verified_at: string | null;
  status: ProgramStatus;
  write_id: string;
  created_at: string;
  updated_at: string;
};

const toProgram = (r: Row): PartnerProgram => ({
  id: r.id,
  merchantId: r.merchant_id,
  name: r.name,
  type: r.type,
  network: r.network,
  provider: r.provider,
  commissionModel: r.commission_model,
  commissionRateBps: r.commission_rate_bps,
  commissionFlatMinor: r.commission_flat_minor,
  currency: r.currency,
  cookieDays: r.cookie_days,
  attributionNotes: r.attribution_notes,
  termsUrl: r.terms_url,
  termsVerifiedAt: r.terms_verified_at,
  status: r.status,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

type Actor = { actorUserId: string; now: string };

/**
 * Null when the merchant does not exist. A program that breaks the CHECK of 0011 (active without terms, or `direct` and active) is rejected
 * by the database (defence in depth: the caller has already run parseProgramForm, so that is a bug, not a user error).
 */
export async function createProgram(db: D1Database, input: Actor & { merchantId: string; program: ProgramInput }): Promise<PartnerProgram | null> {
  const id = ulid(Date.parse(input.now));
  const writeId = ulid();
  const p = input.program;
  const row = await runAudited<Row>(
    db,
    db
      .prepare(
        `INSERT INTO partner_programs (id, merchant_id, name, type, network, provider, commission_model, commission_rate_bps, commission_flat_minor, currency,
                                       cookie_days, attribution_notes, terms_url, terms_verified_at, status, write_id, created_at, updated_at)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?17
         WHERE EXISTS (SELECT 1 FROM merchants WHERE id = ?2)
         RETURNING *`,
      )
      .bind(id, input.merchantId, p.name, p.type, p.network, p.provider, p.commissionModel, p.commissionRateBps, p.commissionFlatMinor, p.currency, p.cookieDays, p.attributionNotes, p.termsUrl, p.termsVerifiedAt, p.status, writeId, input.now),
    { actorUserId: input.actorUserId, action: "program.create", entity: "program", entityId: id, data: { merchantId: input.merchantId, type: p.type }, now: input.now },
    { partnerTable: "partner_programs", id, writeId },
  );
  return row ? toProgram(row) : null;
}

/**
 * Writes every field (the merchant never changes) as a compare-and-set on `status = expectedStatus`, and never moves a program out of `ended` (terminal); null when the program is missing or its
 * status moved meanwhile. Audit: `program.status` (data from, to) when the status changes, else `program.update`. Same CHECK behaviour as createProgram.
 */
export async function updateProgram(db: D1Database, input: Actor & { id: string; program: ProgramInput; expectedStatus: ProgramStatus }): Promise<PartnerProgram | null> {
  const writeId = ulid();
  const p = input.program;
  const changed = p.status !== input.expectedStatus;
  const row = await runAudited<Row>(
    db,
    db
      .prepare(
        `UPDATE partner_programs SET name = ?3, type = ?4, network = ?5, provider = ?6, commission_model = ?7, commission_rate_bps = ?8, commission_flat_minor = ?9,
                currency = ?10, cookie_days = ?11, attribution_notes = ?12, terms_url = ?13, terms_verified_at = ?14, status = ?15, write_id = ?16, updated_at = ?17
         WHERE id = ?1 AND status = ?2 AND (status <> 'ended' OR ?15 = 'ended')
         RETURNING *`,
      )
      .bind(input.id, input.expectedStatus, p.name, p.type, p.network, p.provider, p.commissionModel, p.commissionRateBps, p.commissionFlatMinor, p.currency, p.cookieDays, p.attributionNotes, p.termsUrl, p.termsVerifiedAt, p.status, writeId, input.now),
    {
      actorUserId: input.actorUserId,
      action: changed ? "program.status" : "program.update",
      entity: "program",
      entityId: input.id,
      ...(changed ? { data: { from: input.expectedStatus, to: p.status } } : {}),
      now: input.now,
    },
    { partnerTable: "partner_programs", id: input.id, writeId },
  );
  return row ? toProgram(row) : null;
}

export async function findProgramById(db: D1Database, id: string): Promise<PartnerProgram | null> {
  const row = await db.prepare("SELECT * FROM partner_programs WHERE id = ?1").bind(id).first<Row>();
  return row ? toProgram(row) : null;
}

/** Oldest first. */
export async function listProgramsByMerchant(db: D1Database, merchantId: string): Promise<PartnerProgram[]> {
  const { results } = await db.prepare("SELECT * FROM partner_programs WHERE merchant_id = ?1 ORDER BY created_at, id").bind(merchantId).all<Row>();
  return results.map(toProgram);
}
