import { WORK_LANGUAGES, type WorkLanguage } from "../domain/builder.ts";
import type { BudgetBand } from "../domain/inquiry.ts";
import type { Category } from "../domain/product.ts";
import type { RequestStatus } from "../domain/request.ts";
import { publicId } from "../lib/ulid.ts";
import { jsonList } from "./builders.ts";

// EPIC 27 (public request board, addendum §6). This module is the only writer of request_publications and request_interests
// (test/architecture.test.ts WRITERS). Every write is a statement for the route's db.batch, next to its guarded audit row (ADR-010):
// a compare-and-set on updated_at (the token) that reads its result with RETURNING, never meta.changes. Every write also sets `write_id`, a fresh ULID the
// caller makes once and passes to both the statement and its audit guard: the audit row is guarded on the write's own id, not on the resulting status (two writes
// in the same millisecond can reach the same status; only the winner's write_id is on the row). It is also a ranking file
// (ADR-004): one order only, published_at DESC then public_id DESC; no money table, no priority column.

export type PublicationStatus = "pending_review" | "published" | "rejected" | "withdrawn" | "unpublished";
export type InterestStatus = "pending" | "invited" | "dismissed" | "withdrawn";

type PublicationRow = {
  request_id: string;
  public_id: string;
  status: PublicationStatus;
  public_title: string | null;
  public_description: string | null;
  opted_in_at: string;
  consent_version: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  published_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
};

/** The publication row as the owner, Ops and the client's own pages see it. Never shown on a public page as is (it carries request_id). */
export interface Publication {
  requestId: string;
  publicId: string;
  status: PublicationStatus;
  publicTitle: string | null;
  publicDescription: string | null;
  optedInAt: string;
  consentVersion: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  publishedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toPublication(r: PublicationRow): Publication {
  return {
    requestId: r.request_id,
    publicId: r.public_id,
    status: r.status,
    publicTitle: r.public_title,
    publicDescription: r.public_description,
    optedInAt: r.opted_in_at,
    consentVersion: r.consent_version,
    reviewedBy: r.reviewed_by,
    reviewedAt: r.reviewed_at,
    reviewNote: r.review_note,
    publishedAt: r.published_at,
    endedAt: r.ended_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

type InterestRow = {
  id: string;
  request_id: string;
  builder_id: string;
  note: string | null;
  product_id: string | null;
  status: InterestStatus;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
};

export interface Interest {
  id: string;
  requestId: string;
  builderId: string;
  note: string | null;
  productId: string | null;
  status: InterestStatus;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toInterest(r: InterestRow): Interest {
  return {
    id: r.id,
    requestId: r.request_id,
    builderId: r.builder_id,
    note: r.note,
    productId: r.product_id,
    status: r.status,
    decidedBy: r.decided_by,
    decidedAt: r.decided_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** "This batch's write on the publication went through": the audit row (AuditPublicationGuard) checks that the row carries this write's id. */
export type PublicationGuard = { requestId: string; writeId: string };
/** Same for an interest (AuditInterestGuard). */
export type InterestGuard = { interestId: string; writeId: string };

export function publicationAuditGuard(g: PublicationGuard): { publicationRequestId: string; writeId: string } {
  return { publicationRequestId: g.requestId, writeId: g.writeId };
}

export function interestAuditGuard(g: InterestGuard): { interestId: string; writeId: string } {
  return { interestId: g.interestId, writeId: g.writeId };
}

/** A request is open for the board while it is submitted or matching (spec §7.5). */
const OPEN_REQUEST = "('submitted', 'matching')";
/** L9: the builder condition, named once and written the same way everywhere (joins `builders b` and `users u`). */
const BUILDER_APPROVED_ACTIVE = "b.status = 'approved' AND u.status = 'active'";

// ---------------------------------------------------------------- publication writes

/**
 * First opt-in: inserts the publication as pending_review, only when the request exists in a state that can take it
 * (pending_verification and submitted for the creation path, matching for a later opt-in), has no publication yet and belongs to
 * `clientUserId` (required, enforced in the SQL). 0 rows when any of that fails (a second opt-in does not insert a second row).
 * public_id is random with no time part (S-3). On the creation path it follows the request INSERT in the same db.batch, so the request is visible to its EXISTS.
 */
export function optInStatement(db: D1Database, input: { requestId: string; publicId?: string; consentVersion: string; now: string; clientUserId: string; writeId: string }): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO request_publications (request_id, public_id, status, opted_in_at, consent_version, created_at, updated_at, write_id)
       SELECT ?1, ?2, 'pending_review', ?4, ?3, ?4, ?4, ?6
       WHERE EXISTS (SELECT 1 FROM requests r WHERE r.id = ?1 AND r.status IN ('submitted', 'matching', 'pending_verification')
                       AND r.client_user_id = ?5)
         AND NOT EXISTS (SELECT 1 FROM request_publications x WHERE x.request_id = ?1)
       RETURNING *`,
    )
    .bind(input.requestId, input.publicId ?? publicId(), input.consentVersion, input.now, input.clientUserId, input.writeId);
}

/**
 * The client opts in again after withdrawing (addendum Q6): withdrawn -> pending_review, only while the request is open.
 * Keeps public_id, published_at and the last public text (an earlier first publication keeps its place in the order);
 * resets opted_in_at, consent_version and ended_at. A rejected or unpublished publication cannot come back (0 rows).
 */
export function reOptInStatement(db: D1Database, input: { requestId: string; expectedUpdatedAt: string; consentVersion: string; now: string; clientUserId: string; writeId: string }): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE request_publications SET status = 'pending_review', opted_in_at = ?4, consent_version = ?3, ended_at = NULL, updated_at = ?4, write_id = ?6
       WHERE request_id = ?1 AND status = 'withdrawn' AND updated_at = ?2
         AND EXISTS (SELECT 1 FROM requests r WHERE r.id = ?1 AND r.status IN ${OPEN_REQUEST} AND r.client_user_id = ?5)
       RETURNING *`,
    )
    .bind(input.requestId, input.expectedUpdatedAt, input.consentVersion, input.now, input.clientUserId, input.writeId);
}

/** Ops publishes: pending_review -> published with the (possibly edited) public text. published_at is set the first time only. Needs an open request. */
export function publishStatement(db: D1Database, input: { requestId: string; expectedUpdatedAt: string; title: string; description: string; reviewedBy: string; now: string; writeId: string }): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE request_publications SET status = 'published', public_title = ?3, public_description = ?4, published_at = COALESCE(published_at, ?6),
         reviewed_by = ?5, reviewed_at = ?6, ended_at = NULL, updated_at = ?6, write_id = ?7
       WHERE request_id = ?1 AND status = 'pending_review' AND updated_at = ?2
         AND EXISTS (SELECT 1 FROM requests r WHERE r.id = ?1 AND r.status IN ${OPEN_REQUEST})
       RETURNING *`,
    )
    .bind(input.requestId, input.expectedUpdatedAt, input.title, input.description, input.reviewedBy, input.now, input.writeId);
}

/** Ops edits the public text of a published listing; the status stays published. */
export function editPublicStatement(db: D1Database, input: { requestId: string; expectedUpdatedAt: string; title: string; description: string; reviewedBy: string; now: string; writeId: string }): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE request_publications SET public_title = ?3, public_description = ?4, reviewed_by = ?5, reviewed_at = ?6, updated_at = ?6, write_id = ?7
       WHERE request_id = ?1 AND status = 'published' AND updated_at = ?2
       RETURNING *`,
    )
    .bind(input.requestId, input.expectedUpdatedAt, input.title, input.description, input.reviewedBy, input.now, input.writeId);
}

/** Ops rejects: pending_review -> rejected (final). A review note is required. Not while the request still waits for the client's e-mail confirmation (VNX-2704a L-2). */
export function rejectStatement(db: D1Database, input: { requestId: string; expectedUpdatedAt: string; reviewNote: string; reviewedBy: string; now: string; writeId: string }): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE request_publications SET status = 'rejected', review_note = ?3, reviewed_by = ?4, reviewed_at = ?5, ended_at = ?5, updated_at = ?5, write_id = ?6
       WHERE request_id = ?1 AND status = 'pending_review' AND updated_at = ?2 AND length(trim(?3)) > 0
         AND NOT EXISTS (SELECT 1 FROM requests r WHERE r.id = ?1 AND r.status = 'pending_verification')
       RETURNING *`,
    )
    .bind(input.requestId, input.expectedUpdatedAt, input.reviewNote, input.reviewedBy, input.now, input.writeId);
}

/** Ops unpublishes: published -> unpublished (final). A review note is required. */
export function unpublishStatement(db: D1Database, input: { requestId: string; expectedUpdatedAt: string; reviewNote: string; reviewedBy: string; now: string; writeId: string }): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE request_publications SET status = 'unpublished', review_note = ?3, reviewed_by = ?4, reviewed_at = ?5, ended_at = ?5, updated_at = ?5, write_id = ?6
       WHERE request_id = ?1 AND status = 'published' AND updated_at = ?2 AND length(trim(?3)) > 0
       RETURNING *`,
    )
    .bind(input.requestId, input.expectedUpdatedAt, input.reviewNote, input.reviewedBy, input.now, input.writeId);
}

/**
 * The client withdraws consent: pending_review or published -> withdrawn. Never conditioned on the request's status and never
 * read through a flag (withdrawing consent must always work). `clientUserId` must own the request (required, enforced in the SQL).
 */
export function withdrawStatement(db: D1Database, input: { requestId: string; expectedUpdatedAt: string; now: string; clientUserId: string; writeId: string }): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE request_publications SET status = 'withdrawn', ended_at = ?3, updated_at = ?3, write_id = ?5
       WHERE request_id = ?1 AND status IN ('pending_review', 'published') AND updated_at = ?2
         AND EXISTS (SELECT 1 FROM requests r WHERE r.id = ?1 AND r.client_user_id = ?4)
       RETURNING *`,
    )
    .bind(input.requestId, input.expectedUpdatedAt, input.now, input.clientUserId, input.writeId);
}

/** The publication a batched compare-and-set returned, or null when it lost. */
export function returnedPublication(result: D1Result | undefined): Publication | null {
  const row = result?.results[0] as PublicationRow | undefined;
  return row ? toPublication(row) : null;
}

// ---------------------------------------------------------------- interest writes

/**
 * A builder's "I'm interested". One INSERT ... SELECT holds every gate, so two concurrent requests cannot both pass: the listing is
 * found by its PUBLIC id and the request id is resolved here, in SQL, so no request id ever reaches the route for a non-owner (S-2);
 * the request is open and its publication published; the builder is approved on an active account and is not the client; the builder has
 * no invitation and no interest on this request; fewer than `pendingCap` pending interests on requests that are open now (H1: an
 * interest on a closed or hidden request does not take a place); a given product is the builder's own and published.
 * 0 rows when any gate fails.
 */
export function createInterestStatement(
  db: D1Database,
  input: { id: string; publicId: string; builderId: string; note: string | null; productId: string | null; now: string; pendingCap: number; writeId: string },
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO request_interests (id, request_id, builder_id, note, product_id, status, created_at, updated_at, write_id)
       SELECT ?1, p.request_id, ?3, ?4, ?5, 'pending', ?6, ?6, ?8
       FROM request_publications p JOIN requests r ON r.id = p.request_id
       WHERE p.public_id = ?2 AND r.status IN ${OPEN_REQUEST} AND p.status = 'published' AND r.client_user_id != ?3
         AND EXISTS (SELECT 1 FROM builders b JOIN users u ON u.id = b.user_id WHERE b.user_id = ?3 AND ${BUILDER_APPROVED_ACTIVE})
         AND NOT EXISTS (SELECT 1 FROM request_invites x WHERE x.request_id = p.request_id AND x.builder_id = ?3)
         AND NOT EXISTS (SELECT 1 FROM request_interests i WHERE i.request_id = p.request_id AND i.builder_id = ?3)
         AND (SELECT COUNT(*) FROM request_interests i
                JOIN requests ir ON ir.id = i.request_id
                JOIN request_publications ip ON ip.request_id = i.request_id
              WHERE i.builder_id = ?3 AND i.status = 'pending' AND ir.status IN ${OPEN_REQUEST} AND ip.status = 'published') < ?7
         AND (?5 IS NULL OR EXISTS (SELECT 1 FROM products pr WHERE pr.id = ?5 AND pr.builder_id = ?3 AND pr.status = 'published'))
       RETURNING *`,
    )
    .bind(input.id, input.publicId, input.builderId, input.note, input.productId, input.now, input.pendingCap, input.writeId);
}

/** The builder takes the interest back: pending -> withdrawn, only their own. */
export function withdrawInterestStatement(db: D1Database, input: { interestId: string; builderId: string; expectedUpdatedAt: string; now: string; writeId: string }): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE request_interests SET status = 'withdrawn', updated_at = ?4, write_id = ?5
       WHERE id = ?1 AND builder_id = ?2 AND status = 'pending' AND updated_at = ?3
       RETURNING *`,
    )
    .bind(input.interestId, input.builderId, input.expectedUpdatedAt, input.now, input.writeId);
}

/** Ops dismisses: pending -> dismissed. */
export function dismissInterestStatement(db: D1Database, input: { interestId: string; expectedUpdatedAt: string; decidedBy: string; now: string; writeId: string }): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE request_interests SET status = 'dismissed', decided_by = ?3, decided_at = ?4, updated_at = ?4, write_id = ?5
       WHERE id = ?1 AND status = 'pending' AND updated_at = ?2
       RETURNING *`,
    )
    .bind(input.interestId, input.expectedUpdatedAt, input.decidedBy, input.now, input.writeId);
}

/**
 * Inviting a builder moves their pending interest to invited, in the invite batch: one statement per builder, placed after
 * the invitation inserts. Each moves the interest only when this batch really inserted an invitation for that builder
 * (its id is in `inviteIds`), so an invite that lost the cap leaves the interest pending. RETURNING id.
 */
export function markInterestsInvitedStatements(db: D1Database, input: { requestId: string; builderIds: string[]; inviteIds: string[]; decidedBy: string; now: string; writeId: string }): D1PreparedStatement[] {
  const ids = JSON.stringify(input.inviteIds);
  return input.builderIds.map((builderId) =>
    db
      .prepare(
        `UPDATE request_interests SET status = 'invited', decided_by = ?3, decided_at = ?4, updated_at = ?4, write_id = ?6
         WHERE request_id = ?1 AND builder_id = ?2 AND status = 'pending'
           AND EXISTS (SELECT 1 FROM request_invites x WHERE x.request_id = ?1 AND x.builder_id = ?2 AND x.id IN (SELECT value FROM json_each(?5)))
         RETURNING id`,
      )
      .bind(input.requestId, builderId, input.decidedBy, input.now, ids, input.writeId),
  );
}

/** The interest a batched compare-and-set returned, or null when it lost. */
export function returnedInterest(result: D1Result | undefined): Interest | null {
  const row = result?.results[0] as InterestRow | undefined;
  return row ? toInterest(row) : null;
}

// ---------------------------------------------------------------- reads

export async function findPublicationByRequestId(db: D1Database, requestId: string): Promise<Publication | null> {
  const row = await db.prepare("SELECT * FROM request_publications WHERE request_id = ?1").bind(requestId).first<PublicationRow>();
  return row ? toPublication(row) : null;
}

/**
 * What a public page may know about a listing: the approved public text and the structured fields of the request that are
 * public (category, budget band, country, deadline, languages). Never request_id, client_user_id, the client's name or locale,
 * the original title and description or the admin note. `requestStatus` and `closedAt` feed requestVisibility only.
 */
export interface PublicListing {
  publicId: string;
  publicationStatus: PublicationStatus;
  publicTitle: string | null;
  publicDescription: string | null;
  publishedAt: string | null;
  updatedAt: string;
  category: Category;
  budgetBand: BudgetBand;
  country: string | null;
  deadline: string | null;
  languages: WorkLanguage[];
  requestStatus: RequestStatus;
  closedAt: string | null;
}

type ListingRow = {
  public_id: string;
  pub_status: PublicationStatus;
  public_title: string | null;
  public_description: string | null;
  published_at: string | null;
  pub_updated_at: string;
  category: Category;
  budget_band: BudgetBand;
  country: string | null;
  deadline: string | null;
  languages: string;
  request_status: RequestStatus;
  closed_at: string | null;
};

// The only columns a public query reads; no `r.*`, no identity column (addendum §7).
const LISTING_SELECT = `SELECT p.public_id, p.status AS pub_status, p.public_title, p.public_description, p.published_at, p.updated_at AS pub_updated_at,
    r.category, r.budget_band, r.country, r.deadline, r.languages, r.status AS request_status, r.closed_at
  FROM request_publications p JOIN requests r ON r.id = p.request_id`;

function toListing(r: ListingRow): PublicListing {
  return {
    publicId: r.public_id,
    publicationStatus: r.pub_status,
    publicTitle: r.public_title,
    publicDescription: r.public_description,
    publishedAt: r.published_at,
    updatedAt: r.pub_updated_at,
    category: r.category,
    budgetBand: r.budget_band,
    country: r.country,
    deadline: r.deadline,
    languages: jsonList(r.languages).filter((l): l is WorkLanguage => (WORK_LANGUAGES as readonly string[]).includes(l)),
    requestStatus: r.request_status,
    closedAt: r.closed_at,
  };
}

/** The listing behind /requests/:publicId: a published publication (open or closed request; requestVisibility decides what shows). */
export async function findPublicListing(db: D1Database, publicId: string): Promise<PublicListing | null> {
  const row = await db.prepare(`${LISTING_SELECT} WHERE p.public_id = ?1 AND p.status = 'published'`).bind(publicId).first<ListingRow>();
  return row ? toListing(row) : null;
}

export type BoardFilter = { category?: Category; budget?: BudgetBand; lang?: WorkLanguage };

function openWhere(filter: BoardFilter): { where: string; binds: (string | null)[] } {
  return {
    where: `p.status = 'published' AND r.status IN ${OPEN_REQUEST}
      AND (?1 IS NULL OR r.category = ?1) AND (?2 IS NULL OR r.budget_band = ?2)
      AND (?3 IS NULL OR EXISTS (SELECT 1 FROM json_each(r.languages) WHERE value = ?3))`,
    binds: [filter.category ?? null, filter.budget ?? null, filter.lang ?? null],
  };
}

/** Open listings, newest first publication first: published_at DESC, public_id DESC. The only order there is. */
export async function listOpenPublications(db: D1Database, filter: BoardFilter, limit: number, offset: number): Promise<PublicListing[]> {
  const { where, binds } = openWhere(filter);
  const { results } = await db
    .prepare(`${LISTING_SELECT} WHERE ${where} ORDER BY p.published_at DESC, p.public_id DESC LIMIT ?4 OFFSET ?5`)
    .bind(...binds, limit, offset)
    .all<ListingRow>();
  return results.map(toListing);
}

export async function countOpenPublications(db: D1Database, filter: BoardFilter): Promise<number> {
  const { where, binds } = openWhere(filter);
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM request_publications p JOIN requests r ON r.id = p.request_id WHERE ${where}`).bind(...binds).first<{ n: number }>();
  return row?.n ?? 0;
}

/** All open listings, for the "fewer than 5: noindex" threshold. */
export async function countOpenPublicationsAll(db: D1Database): Promise<number> {
  return countOpenPublications(db, {});
}

/** Sitemap rows: open listings only, same order. `lastmod` is the publication's updated_at. The query lives here, not in seo.ts (ADR-004 file rules). */
export async function listSitemapRequests(db: D1Database, limit = 2000): Promise<{ publicId: string; lastmod: string }[]> {
  const { results } = await db
    .prepare(
      `SELECT p.public_id, p.updated_at FROM request_publications p JOIN requests r ON r.id = p.request_id
       WHERE p.status = 'published' AND r.status IN ${OPEN_REQUEST}
       ORDER BY p.published_at DESC, p.public_id DESC LIMIT ?1`,
    )
    .bind(limit)
    .all<{ public_id: string; updated_at: string }>();
  return results.map((r) => ({ publicId: r.public_id, lastmod: r.updated_at }));
}

/**
 * H2: what the signed-in viewer is to this listing, in ONE query (call it only for a signed-in viewer). `ownRequestId` is set
 * only when the viewer is the client of the request; nobody else ever receives a request id. `builder` is the viewer's builder state (the "approved" branch is the L9
 * condition) so the call to action needs no second query (additive to the planned shape).
 */
export interface ViewerRelation {
  ownRequestId: string | null;
  inviteId: string | null;
  interest: { id: string; status: InterestStatus } | null;
  /** The viewer's own published products (the select of the interest form), by name; empty for anyone without any. Read in the same query. */
  products: { id: string; name: string }[];
  /** The viewer as a builder: no builders row, approved on an active account (L9), or any other state. Feeds the call-to-action table without a second query. */
  builder: "none" | "approved" | "not_approved";
}

export async function findViewerRelation(db: D1Database, publicId: string, userId: string): Promise<ViewerRelation> {
  const row = await db
    .prepare(
      `SELECT CASE WHEN r.client_user_id = ?2 THEN r.id END AS own_request_id,
         (SELECT x.id FROM request_invites x WHERE x.request_id = r.id AND x.builder_id = ?2) AS invite_id,
         (SELECT i.id FROM request_interests i WHERE i.request_id = r.id AND i.builder_id = ?2) AS interest_id,
         (SELECT i.status FROM request_interests i WHERE i.request_id = r.id AND i.builder_id = ?2) AS interest_status,
         (SELECT json_group_array(json_object('id', q.id, 'name', q.name)) FROM (SELECT pr.id, pr.name FROM products pr WHERE pr.builder_id = ?2 AND pr.status = 'published' ORDER BY pr.name, pr.id) q) AS products,
         CASE WHEN NOT EXISTS (SELECT 1 FROM builders nb WHERE nb.user_id = ?2) THEN 'none'
              WHEN EXISTS (SELECT 1 FROM builders b JOIN users u ON u.id = b.user_id WHERE b.user_id = ?2 AND ${BUILDER_APPROVED_ACTIVE}) THEN 'approved'
              ELSE 'not_approved' END AS builder_state
       FROM request_publications p JOIN requests r ON r.id = p.request_id
       WHERE p.public_id = ?1`,
    )
    .bind(publicId, userId)
    .first<{ own_request_id: string | null; invite_id: string | null; interest_id: string | null; interest_status: InterestStatus | null; products: string; builder_state: ViewerRelation["builder"] }>();
  if (!row) return { ownRequestId: null, inviteId: null, interest: null, products: [], builder: "none" };
  return {
    ownRequestId: row.own_request_id,
    inviteId: row.invite_id,
    interest: row.interest_id && row.interest_status ? { id: row.interest_id, status: row.interest_status } : null,
    products: JSON.parse(row.products) as { id: string; name: string }[],
    builder: row.builder_state,
  };
}

/** An interest with its builder's public name (Ops "Interested builders"). `builderPublic` is the L9 condition. */
export interface InterestWithBuilder {
  interest: Interest;
  builderName: string;
  builderHandle: string;
  builderPublic: boolean;
  productName: string | null;
  /** The attached product's public page (/p/:slug) exists only while it is published. */
  productSlug: string | null;
}

export async function listInterestsForRequest(db: D1Database, requestId: string): Promise<InterestWithBuilder[]> {
  const { results } = await db
    .prepare(
      `SELECT i.*, b.name AS builder_name, b.handle AS builder_handle, (${BUILDER_APPROVED_ACTIVE}) AS builder_public, pr.name AS product_name, CASE WHEN pr.status = 'published' THEN pr.slug END AS product_slug
       FROM request_interests i JOIN builders b ON b.user_id = i.builder_id JOIN users u ON u.id = b.user_id
         LEFT JOIN products pr ON pr.id = i.product_id
       WHERE i.request_id = ?1 ORDER BY i.created_at, i.id`,
    )
    .bind(requestId)
    .all<InterestRow & { builder_name: string; builder_handle: string; builder_public: number; product_name: string | null; product_slug: string | null }>();
  return results.map((r) => ({ interest: toInterest(r), builderName: r.builder_name, builderHandle: r.builder_handle, builderPublic: r.builder_public === 1, productName: r.product_name, productSlug: r.product_slug }));
}

/** A builder's own interests for the Hub (withdrawn ones are left out, L4): the listing's public id and title, never the request id. Newest first. */
export interface BuilderInterestItem {
  id: string;
  status: InterestStatus;
  createdAt: string;
  publicId: string;
  /** The public title only while the publication is published and the request not removed; null otherwise. */
  publicTitle: string | null;
  requestStatus: RequestStatus;
  /** For requestVisibility (the 30-day window of a closed request). */
  closedAt: string | null;
  publicationStatus: PublicationStatus;
  /** The builder's invitation to this request, once Ops invited them (the Hub links to it). */
  inviteId: string | null;
}

export async function listBuilderInterests(db: D1Database, builderId: string, limit = 100): Promise<BuilderInterestItem[]> {
  const { results } = await db
    .prepare(
      `SELECT i.id, i.status, i.created_at, p.public_id,
         CASE WHEN p.status = 'published' AND r.status <> 'removed' THEN p.public_title END AS public_title,
         p.status AS pub_status, r.status AS request_status, r.closed_at,
         (SELECT x.id FROM request_invites x WHERE x.request_id = i.request_id AND x.builder_id = i.builder_id) AS invite_id
       FROM request_interests i JOIN request_publications p ON p.request_id = i.request_id JOIN requests r ON r.id = i.request_id
       WHERE i.builder_id = ?1 AND i.status <> 'withdrawn' ORDER BY i.created_at DESC, i.id DESC LIMIT ?2`,
    )
    .bind(builderId, limit)
    .all<{ id: string; status: InterestStatus; created_at: string; public_id: string; public_title: string | null; pub_status: PublicationStatus; request_status: RequestStatus; closed_at: string | null; invite_id: string | null }>();
  return results.map((r) => ({ id: r.id, status: r.status, createdAt: r.created_at, publicId: r.public_id, publicTitle: r.public_title, requestStatus: r.request_status, closedAt: r.closed_at, publicationStatus: r.pub_status, inviteId: r.invite_id }));
}

/**
 * Why the INSERT wrote nothing, for the message only (the INSERT alone decided), in ONE read: the product is not the builder's own published one,
 * the builder already has `pendingCap` waiting interests on open requests, and what the builder now has on this listing (an invitation or an interest
 * that a race may just have created), so the page can be drawn again without a second relation query.
 */
export async function diagnoseInterestRefusal(
  db: D1Database,
  input: { publicId: string; builderId: string; productId: string | null; pendingCap: number },
): Promise<{ badProduct: boolean; capped: boolean; inviteId: string | null; interest: { id: string; status: InterestStatus } | null }> {
  const row = await db
    .prepare(
      `SELECT (?3 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM products pr WHERE pr.id = ?3 AND pr.builder_id = ?2 AND pr.status = 'published')) AS bad_product,
              ((SELECT COUNT(*) FROM request_interests i JOIN requests ir ON ir.id = i.request_id JOIN request_publications ip ON ip.request_id = i.request_id
                WHERE i.builder_id = ?2 AND i.status = 'pending' AND ir.status IN ${OPEN_REQUEST} AND ip.status = 'published') >= ?4) AS capped,
              (SELECT x.id FROM request_publications p JOIN request_invites x ON x.request_id = p.request_id WHERE p.public_id = ?1 AND x.builder_id = ?2) AS invite_id,
              (SELECT i.id FROM request_publications p JOIN request_interests i ON i.request_id = p.request_id WHERE p.public_id = ?1 AND i.builder_id = ?2) AS interest_id,
              (SELECT i.status FROM request_publications p JOIN request_interests i ON i.request_id = p.request_id WHERE p.public_id = ?1 AND i.builder_id = ?2) AS interest_status`,
    )
    .bind(input.publicId, input.builderId, input.productId, input.pendingCap)
    .first<{ bad_product: number; capped: number; invite_id: string | null; interest_id: string | null; interest_status: InterestStatus | null }>();
  return {
    badProduct: row?.bad_product === 1,
    capped: row?.capped === 1,
    inviteId: row?.invite_id ?? null,
    interest: row?.interest_id && row.interest_status ? { id: row.interest_id, status: row.interest_status } : null,
  };
}

export async function findInterestFor(db: D1Database, requestId: string, builderId: string): Promise<Interest | null> {
  const row = await db.prepare("SELECT * FROM request_interests WHERE request_id = ?1 AND builder_id = ?2").bind(requestId, builderId).first<InterestRow>();
  return row ? toInterest(row) : null;
}

export async function findInterestById(db: D1Database, id: string): Promise<Interest | null> {
  const row = await db.prepare("SELECT * FROM request_interests WHERE id = ?1").bind(id).first<InterestRow>();
  return row ? toInterest(row) : null;
}

/**
 * The review queue: publications waiting for review on a request that is open AND confirmed (`submitted|matching`; a `pending_verification`
 * request is not in it until the client confirms their e-mail, a closed one never). One definition for the Overview card, the list filter and
 * the block on the request page. `oldest`: since when the oldest has been waiting, which is the later of the opt-in and the request's own submission.
 */
const REVIEW_QUEUE = `FROM request_publications p JOIN requests r ON r.id = p.request_id WHERE p.status = 'pending_review' AND r.status IN ${OPEN_REQUEST}`;

/** Ops Overview: how many listings wait for review and since when the oldest has. */
export async function publicationReviewQueue(db: D1Database): Promise<{ count: number; oldest: string | null }> {
  const row = await db
    .prepare(`SELECT COUNT(*) AS n, MIN(max(p.opted_in_at, COALESCE(r.submitted_at, p.opted_in_at))) AS oldest ${REVIEW_QUEUE}`)
    .first<{ n: number; oldest: string | null }>();
  if (!row) throw new Error("publication review queue count returned no row");
  return { count: row.n, oldest: row.oldest };
}

/** Ops Overview: publications waiting for review on a request that is still open. */
export async function countPublicationReviewQueue(db: D1Database): Promise<number> {
  return (await publicationReviewQueue(db)).count;
}

/** The Requests list filter `public=pending`: the ids in the review queue, oldest waiting first (the same instant as the Overview card's age), narrowed to titles containing `q`. */
export async function listReviewQueueRequestIds(db: D1Database, q: string | null, limit = 200): Promise<string[]> {
  const { results } = await db
    .prepare(`SELECT r.id ${REVIEW_QUEUE} AND (?1 IS NULL OR instr(lower(r.title), ?1) > 0) ORDER BY max(p.opted_in_at, COALESCE(r.submitted_at, p.opted_in_at)), r.id LIMIT ?2`)
    .bind(q === null ? null : q.toLowerCase(), limit)
    .all<{ id: string }>();
  return results.map((r) => r.id);
}

/**
 * The interests queue: pending interests on an open, published request from a builder who is approved on an active account (L9). One definition
 * for the Overview card and, through `listInterestsForRequest` (same builder condition), the block on the request page.
 * `oldest`: when the oldest of them was sent.
 */
export async function interestQueue(db: D1Database): Promise<{ count: number; oldest: string | null }> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n, MIN(i.created_at) AS oldest FROM request_interests i
         JOIN request_publications p ON p.request_id = i.request_id JOIN requests r ON r.id = i.request_id
         JOIN builders b ON b.user_id = i.builder_id JOIN users u ON u.id = b.user_id
       WHERE i.status = 'pending' AND p.status = 'published' AND r.status IN ${OPEN_REQUEST} AND ${BUILDER_APPROVED_ACTIVE}`,
    )
    .first<{ n: number; oldest: string | null }>();
  if (!row) throw new Error("interest queue count returned no row");
  return { count: row.n, oldest: row.oldest };
}

/** Ops Overview: pending interests waiting for Ops (see interestQueue). */
export async function countInterestQueue(db: D1Database): Promise<number> {
  return (await interestQueue(db)).count;
}

/** The pending interests of `builderIds` on a request, by builder: read before the invite batch, so each interest the batch flips can get its audit row (guarded on the interest and the batch's write id). */
export async function findPendingInterestIds(db: D1Database, requestId: string, builderIds: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (builderIds.length === 0) return out;
  const { results } = await db
    .prepare("SELECT id, builder_id FROM request_interests WHERE request_id = ?1 AND status = 'pending' AND builder_id IN (SELECT value FROM json_each(?2))")
    .bind(requestId, JSON.stringify(builderIds))
    .all<{ id: string; builder_id: string }>();
  for (const r of results) out.set(r.builder_id, r.id);
  return out;
}

/** The Ops requests list column "Public": each request's publication status and updated_at, for the ids on the page. */
export async function listPublicationsForOps(db: D1Database, requestIds: readonly string[]): Promise<Map<string, { status: PublicationStatus; updatedAt: string }>> {
  const out = new Map<string, { status: PublicationStatus; updatedAt: string }>();
  if (requestIds.length === 0) return out;
  const { results } = await db
    .prepare("SELECT request_id, status, updated_at FROM request_publications WHERE request_id IN (SELECT value FROM json_each(?1))")
    .bind(JSON.stringify(requestIds))
    .all<{ request_id: string; status: PublicationStatus; updated_at: string }>();
  for (const r of results) out.set(r.request_id, { status: r.status, updatedAt: r.updated_at });
  return out;
}
