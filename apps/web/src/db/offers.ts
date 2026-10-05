import type { MerchantStatus } from "../domain/merchant.ts";
import type { OfferInput, OfferKind, OfferLabel, OfferStatus, ProgramStatus, ProgramType, RedirectInput, RedirectMerchant, RedirectOffer, RedirectProgram } from "../domain/offer.ts";
import { ulid } from "../lib/ulid.ts";
import { runAudited } from "./audit.ts";
import { parseStoredHosts } from "./merchants.ts";

/** The only writer of `offers` (module `monetization`, addendum §3.2). */

export type Offer = {
  id: string;
  programId: string | null;
  subjectType: "product" | "merchant" | "article";
  subjectId: string;
  kind: OfferKind;
  label: OfferLabel;
  destinationUrl: string;
  trackingTemplate: string | null;
  startsAt: string | null;
  endsAt: string | null;
  status: OfferStatus;
  createdAt: string;
  updatedAt: string;
};

type Row = {
  id: string;
  program_id: string | null;
  subject_type: "product" | "merchant" | "article";
  subject_id: string;
  kind: OfferKind;
  label: OfferLabel;
  destination_url: string;
  tracking_template: string | null;
  status: OfferStatus;
  starts_at: string | null;
  ends_at: string | null;
  write_id: string;
  created_at: string;
  updated_at: string;
};

const toOffer = (r: Row): Offer => ({
  id: r.id,
  programId: r.program_id,
  subjectType: r.subject_type,
  subjectId: r.subject_id,
  kind: r.kind,
  label: r.label,
  destinationUrl: r.destination_url,
  trackingTemplate: r.tracking_template,
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  status: r.status,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

type Actor = { actorUserId: string; now: string };

/**
 * Null when the merchant (`subject_id`) does not exist or the program belongs to another merchant: nothing is written, nothing audited
 * (the caller has already run parseOfferForm, so that is a bug or a race, not a user error). A CHECK of 0011 (a program without a
 * template, an unknown label) is rejected by the database and throws.
 */
export async function createOffer(db: D1Database, input: Actor & { offer: OfferInput }): Promise<Offer | null> {
  const id = ulid(Date.parse(input.now));
  const writeId = ulid();
  const o = input.offer;
  const row = await runAudited<Row>(
    db,
    db
      .prepare(
        `INSERT INTO offers (id, program_id, subject_type, subject_id, kind, label, destination_url, tracking_template, status, starts_at, ends_at, write_id, created_at, updated_at)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?13
         WHERE ?3 = 'merchant' AND EXISTS (SELECT 1 FROM merchants WHERE id = ?4)
           AND (?2 IS NULL OR EXISTS (SELECT 1 FROM partner_programs WHERE id = ?2 AND merchant_id = ?4))
         RETURNING *`,
      )
      .bind(id, o.programId, o.subjectType, o.subjectId, o.kind, o.label, o.destinationUrl, o.trackingTemplate, o.status, o.startsAt, o.endsAt, writeId, input.now),
    { actorUserId: input.actorUserId, action: "offer.create", entity: "offer", entityId: id, data: { merchantId: o.subjectId, programId: o.programId }, now: input.now },
    { partnerTable: "offers", id, writeId },
  );
  return row ? toOffer(row) : null;
}

/**
 * Compare-and-set on `status = expectedStatus`; the offer keeps its merchant (`subject_id` must equal the input's) and may only point at a
 * program of that merchant; `archived` is terminal (the status may only stay `archived`). Null when any of these fails or the offer is missing:
 * nothing written, nothing audited. Audit: `offer.status` (data from, to) when the status changes, else `offer.update`.
 */
export async function updateOffer(db: D1Database, input: Actor & { id: string; offer: OfferInput; expectedStatus: OfferStatus }): Promise<Offer | null> {
  const writeId = ulid();
  const o = input.offer;
  const changed = o.status !== input.expectedStatus;
  const row = await runAudited<Row>(
    db,
    db
      .prepare(
        `UPDATE offers SET program_id = ?3, kind = ?4, label = ?5, destination_url = ?6, tracking_template = ?7, starts_at = ?8, ends_at = ?9,
                status = ?10, write_id = ?11, updated_at = ?12
         WHERE id = ?1 AND status = ?2 AND subject_type = 'merchant' AND subject_id = ?13
           AND (status <> 'archived' OR ?10 = 'archived')
           AND (?3 IS NULL OR EXISTS (SELECT 1 FROM partner_programs WHERE id = ?3 AND merchant_id = ?13))
         RETURNING *`,
      )
      .bind(input.id, input.expectedStatus, o.programId, o.kind, o.label, o.destinationUrl, o.trackingTemplate, o.startsAt, o.endsAt, o.status, writeId, input.now, o.subjectId),
    {
      actorUserId: input.actorUserId,
      action: changed ? "offer.status" : "offer.update",
      entity: "offer",
      entityId: input.id,
      ...(changed ? { data: { from: input.expectedStatus, to: o.status } } : {}),
      now: input.now,
    },
    { partnerTable: "offers", id: input.id, writeId },
  );
  return row ? toOffer(row) : null;
}

export async function findOfferById(db: D1Database, id: string): Promise<Offer | null> {
  const row = await db.prepare("SELECT * FROM offers WHERE id = ?1").bind(id).first<Row>();
  return row ? toOffer(row) : null;
}

/** For /admin/merchants/:id: the merchant's own offers (subject_type merchant), oldest first. */
export async function listOffersByMerchant(db: D1Database, merchantId: string): Promise<Offer[]> {
  const { results } = await db.prepare("SELECT * FROM offers WHERE subject_type = 'merchant' AND subject_id = ?1 ORDER BY created_at, id").bind(merchantId).all<Row>();
  return results.map(toOffer);
}

/** What resolveOfferRedirect takes from the database (domain/offer.ts#RedirectInput). */
export type RedirectRows = Pick<RedirectInput, "offer" | "program" | "merchant">;

type ContextRow = {
  o_id: string;
  o_subject_type: "product" | "merchant" | "article";
  o_subject_id: string;
  o_program_id: string | null;
  o_status: OfferStatus;
  o_destination_url: string;
  o_tracking_template: string | null;
  o_starts_at: string | null;
  o_ends_at: string | null;
  p_id: string | null;
  p_merchant_id: string | null;
  p_type: ProgramType | null;
  p_status: ProgramStatus | null;
  m_id: string | null;
  m_status: MerchantStatus | null;
  m_website_url: string | null;
  m_allowed_hosts: string | null;
};

// One query. The merchant is the offer's subject (never the program's merchant: the domain compares the two); the program comes from program_id.
const CONTEXT_SQL = `SELECT o.id AS o_id, o.subject_type AS o_subject_type, o.subject_id AS o_subject_id, o.program_id AS o_program_id, o.status AS o_status,
       o.destination_url AS o_destination_url, o.tracking_template AS o_tracking_template, o.starts_at AS o_starts_at, o.ends_at AS o_ends_at,
       p.id AS p_id, p.merchant_id AS p_merchant_id, p.type AS p_type, p.status AS p_status,
       m.id AS m_id, m.status AS m_status, m.website_url AS m_website_url, m.allowed_hosts AS m_allowed_hosts
  FROM offers o
  LEFT JOIN partner_programs p ON p.id = o.program_id
  LEFT JOIN merchants m ON m.id = o.subject_id AND o.subject_type = 'merchant'`;

function toRedirectRows(r: ContextRow): { offer: RedirectOffer; program: RedirectProgram | null; merchant: RedirectMerchant | null } {
  return {
    offer: {
      id: r.o_id,
      subjectType: r.o_subject_type,
      subjectId: r.o_subject_id,
      programId: r.o_program_id,
      status: r.o_status,
      destinationUrl: r.o_destination_url,
      trackingTemplate: r.o_tracking_template,
      startsAt: r.o_starts_at,
      endsAt: r.o_ends_at,
    },
    program: r.p_id === null || r.p_merchant_id === null || r.p_type === null || r.p_status === null ? null : { id: r.p_id, merchantId: r.p_merchant_id, type: r.p_type, status: r.p_status },
    merchant:
      r.m_id === null || r.m_status === null || r.m_website_url === null || r.m_allowed_hosts === null
        ? null
        : { id: r.m_id, status: r.m_status, websiteUrl: r.m_website_url, allowedHosts: parseStoredHosts(r.m_allowed_hosts) },
  };
}

/** For /go/o/:offerId. An unknown offer gives three nulls, which resolveOfferRedirect answers with `offer_missing`. */
export async function findOfferWithContext(db: D1Database, offerId: string): Promise<RedirectRows> {
  const row = await db.prepare(`${CONTEXT_SQL} WHERE o.id = ?1`).bind(offerId).first<ContextRow>();
  return row ? toRedirectRows(row) : { offer: null, program: null, merchant: null };
}

/**
 * For /go/:merchantSlug: the merchant's default offer. Null when the slug is unknown, the merchant has no default offer, or the default
 * offer is not a merchant offer of that same merchant (the merchant is joined through the offer's subject_id, so a foreign offer never matches).
 * A paused merchant is still returned: the route turns `merchant.status !== "active"` into 404.
 */
export async function findDefaultOfferContext(db: D1Database, merchantSlug: string): Promise<(RedirectRows & { offer: RedirectOffer; merchant: RedirectMerchant }) | null> {
  const row = await db.prepare(`${CONTEXT_SQL} WHERE m.slug = ?1 AND m.default_offer_id = o.id AND o.subject_type = 'merchant'`).bind(merchantSlug).first<ContextRow>();
  if (!row) return null;
  const rows = toRedirectRows(row);
  return rows.merchant ? { ...rows, merchant: rows.merchant } : null;
}
