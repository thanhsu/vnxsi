import { WORK_LANGUAGES, type Availability, type WorkLanguage } from "../domain/builder.ts";
import type { BudgetBand } from "../domain/inquiry.ts";
import type { Category } from "../domain/product.ts";
import {
  MAX_ACTIVE_INVITES,
  type AdminRequest,
  type Candidate,
  type InvitationListItem,
  type Invitation,
  type InviteStatus,
  type InviteWithBuilder,
  type ClientRequest,
  type ProposalInput,
  type RequestInvite,
  type RequestStatus,
  type TerminalRequestStatus,
} from "../domain/request.ts";
import { ulid } from "../lib/ulid.ts";
import { jsonList } from "./builders.ts";

type Row = {
  id: string;
  client_user_id: string;
  client_name: string;
  title: string;
  description: string;
  category: Category;
  budget_band: BudgetBand;
  deadline: string | null;
  languages: string;
  status: RequestStatus;
  locale: string;
  admin_note: string | null;
  selected_invite_id: string | null;
  submitted_at: string | null;
  matched_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

export function toRequest(r: Row): ClientRequest {
  return {
    id: r.id,
    clientUserId: r.client_user_id,
    clientName: r.client_name,
    title: r.title,
    description: r.description,
    category: r.category,
    budgetBand: r.budget_band,
    deadline: r.deadline,
    languages: jsonList(r.languages).filter((l): l is WorkLanguage => (WORK_LANGUAGES as readonly string[]).includes(l)),
    status: r.status,
    locale: r.locale,
    adminNote: r.admin_note,
    selectedInviteId: r.selected_invite_id,
    submittedAt: r.submitted_at,
    matchedAt: r.matched_at,
    closedAt: r.closed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export type InviteRow = {
  id: string;
  request_id: string;
  builder_id: string;
  invited_by: string;
  status: InviteStatus;
  approach: string | null;
  price_cents: number | null;
  price_max_cents: number | null;
  price_note: string | null;
  timeline_days: number | null;
  decline_reason: string | null;
  invited_at: string;
  responded_at: string | null;
  reminded_at: string | null;
  inquiry_id: string | null;
  created_at: string;
  updated_at: string;
};

export function toInvite(r: InviteRow): RequestInvite {
  return {
    id: r.id,
    requestId: r.request_id,
    builderId: r.builder_id,
    invitedBy: r.invited_by,
    status: r.status,
    approach: r.approach,
    priceCents: r.price_cents,
    priceMaxCents: r.price_max_cents,
    priceNote: r.price_note,
    timelineDays: r.timeline_days,
    declineReason: r.decline_reason,
    invitedAt: r.invited_at,
    respondedAt: r.responded_at,
    remindedAt: r.reminded_at,
    inquiryId: r.inquiry_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** "This batch's compare-and-set on the request went through": statements batched after it check this. */
export type RequestGuard = { requestId: string; status: RequestStatus; updatedAt: string };
/** Same for an invitation. */
export type InviteGuard = { inviteId: string; status: InviteStatus; updatedAt: string };

export type NewRequest = {
  clientUserId: string;
  clientName: string;
  title: string;
  description: string;
  category: Category;
  budgetBand: BudgetBand;
  deadline: string | null;
  languages: WorkLanguage[];
  status: "submitted" | "pending_verification";
  locale: string;
  now: string;
};

export async function createRequest(db: D1Database, input: NewRequest): Promise<ClientRequest> {
  const row = await db
    .prepare(
      `INSERT INTO requests (id, client_user_id, client_name, title, description, category, budget_band, deadline, languages, status, locale,
         submitted_at, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, CASE WHEN ?10 = 'submitted' THEN ?12 END, ?12, ?12)
       RETURNING *`,
    )
    .bind(ulid(Date.parse(input.now)), input.clientUserId, input.clientName, input.title, input.description, input.category, input.budgetBand, input.deadline, JSON.stringify(input.languages), input.status, input.locale, input.now)
    .first<Row>();
  if (!row) throw new Error("request insert failed");
  return toRequest(row);
}

export async function findRequestById(db: D1Database, id: string): Promise<ClientRequest | null> {
  const row = await db.prepare("SELECT * FROM requests WHERE id = ?1").bind(id).first<Row>();
  return row ? toRequest(row) : null;
}

// Spec §5.4: the client never sees a request the admin removed as spam.
export async function findClientRequest(db: D1Database, clientUserId: string, id: string): Promise<ClientRequest | null> {
  const row = await db.prepare("SELECT * FROM requests WHERE id = ?1 AND client_user_id = ?2 AND status != 'removed'").bind(id, clientUserId).first<Row>();
  return row ? toRequest(row) : null;
}

/** Most recently changed first. */
export async function listClientRequests(db: D1Database, clientUserId: string, limit = 200): Promise<ClientRequest[]> {
  const { results } = await db
    .prepare("SELECT * FROM requests WHERE client_user_id = ?1 AND status != 'removed' ORDER BY updated_at DESC, id DESC LIMIT ?2")
    .bind(clientUserId, limit)
    .all<Row>();
  return results.map(toRequest);
}

/** The request with its client's e-mail and locale, used only as a recipient (notifications) or on admin pages. */
export async function findRequestWithClient(db: D1Database, id: string): Promise<{ request: ClientRequest; client: { email: string; locale: string } } | null> {
  const row = await db
    .prepare("SELECT r.*, u.email AS client_email, u.locale AS client_locale FROM requests r JOIN users u ON u.id = r.client_user_id WHERE r.id = ?1")
    .bind(id)
    .first<Row & { client_email: string; client_locale: string }>();
  return row ? { request: toRequest(row), client: { email: row.client_email, locale: row.client_locale } } : null;
}

const TERMINAL_SQL = "('builder_selected', 'rejected', 'expired', 'closed', 'removed')";

/**
 * Compare-and-set on status, as a statement for db.batch. Stamps submitted_at, matched_at (first time only) and
 * closed_at (terminal) from the new status. Returns the row, or nothing when the status was no longer `from`.
 */
export function setRequestStatusStatement(
  db: D1Database,
  input: { id: string; from: RequestStatus; to: RequestStatus; now: string; adminNote?: string | null; selectedInviteId?: string | null },
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE requests SET status = ?3, updated_at = ?4,
         submitted_at = CASE WHEN ?3 = 'submitted' THEN COALESCE(submitted_at, ?4) ELSE submitted_at END,
         matched_at = CASE WHEN ?3 = 'matching' THEN COALESCE(matched_at, ?4) ELSE matched_at END,
         closed_at = CASE WHEN ?3 IN ${TERMINAL_SQL} THEN ?4 ELSE closed_at END,
         admin_note = COALESCE(?5, admin_note),
         selected_invite_id = COALESCE(?6, selected_invite_id)
       WHERE id = ?1 AND status = ?2
         AND (?6 IS NULL OR EXISTS (SELECT 1 FROM request_invites x JOIN builders b ON b.user_id = x.builder_id JOIN users u ON u.id = b.user_id
           WHERE x.id = ?6 AND x.request_id = ?1 AND x.status = 'proposed' AND b.status = 'approved' AND u.status = 'active'))
       RETURNING *`,
    )
    .bind(input.id, input.from, input.to, input.now, input.adminNote ?? null, input.selectedInviteId ?? null);
}

/** The request a batched compare-and-set returned, or null when it lost. */
export function returnedRequest(result: D1Result | undefined): ClientRequest | null {
  const row = result?.results[0] as Row | undefined;
  return row ? toRequest(row) : null;
}

/**
 * Spec §7.5: a request entering a terminal status settles its invitations in the same transaction: invited -> expired,
 * proposed -> not_selected. `between` runs right after the compare-and-set (selecting a proposal marks it selected
 * there, so it is not swept to not_selected). Every settling statement checks that this batch's compare-and-set won.
 * Callers append their audit statement after `statements`.
 */
export function endRequestBatch(
  db: D1Database,
  input: { id: string; from: RequestStatus; to: TerminalRequestStatus; now: string; adminNote?: string | null; selectedInviteId?: string | null },
  between: D1PreparedStatement[] = [],
): { statements: D1PreparedStatement[]; read: (results: D1Result[]) => { request: ClientRequest | null; notSelected: string[]; expired: string[] } } {
  const won = "EXISTS (SELECT 1 FROM requests WHERE id = ?1 AND status = ?2 AND updated_at = ?3)";
  const statements = [
    setRequestStatusStatement(db, input),
    ...between,
    db.prepare(`UPDATE request_invites SET status = 'expired', updated_at = ?3 WHERE request_id = ?1 AND status = 'invited' AND ${won} RETURNING id`).bind(input.id, input.to, input.now),
    db.prepare(`UPDATE request_invites SET status = 'not_selected', updated_at = ?3 WHERE request_id = ?1 AND status = 'proposed' AND ${won} RETURNING id`).bind(input.id, input.to, input.now),
  ];
  const expiredAt = 1 + between.length;
  return {
    statements,
    read: (results) => ({
      request: returnedRequest(results[0]),
      notSelected: ((results[expiredAt + 1]?.results ?? []) as { id: string }[]).map((r) => r.id),
      expired: ((results[expiredAt]?.results ?? []) as { id: string }[]).map((r) => r.id),
    }),
  };
}

/**
 * Spec §5.7 step 2 / §7.6: invites each builder unless already invited, the builder is the client, the builder is not
 * approved on an active account, the request is not submitted/matching, or 5 invitations are already active (an invitation of a builder no longer approved on an active account does not count, M6 review F5). The cap
 * is checked inside each INSERT, so concurrent admins cannot pass it. Then the request moves to matching, only if this
 * batch invited someone (matched_at keeps the first invitation's time).
 */
export function inviteBuildersBatch(
  db: D1Database,
  input: { requestId: string; builderIds: string[]; invitedBy: string; now: string },
): { statements: D1PreparedStatement[]; inviteIds: string[]; read: (results: D1Result[]) => { request: ClientRequest | null; invited: { id: string; builderId: string }[] } } {
  const at = Date.parse(input.now);
  const inviteIds = input.builderIds.map(() => ulid(at));
  const inserts = input.builderIds.map((builderId, i) =>
    db
      .prepare(
        `INSERT INTO request_invites (id, request_id, builder_id, invited_by, status, invited_at, created_at, updated_at)
         SELECT ?1, ?2, ?3, ?4, 'invited', ?5, ?5, ?5
         WHERE EXISTS (SELECT 1 FROM requests r WHERE r.id = ?2 AND r.status IN ('submitted', 'matching') AND r.client_user_id != ?3)
           AND EXISTS (SELECT 1 FROM builders b JOIN users u ON u.id = b.user_id WHERE b.user_id = ?3 AND b.status = 'approved' AND u.status = 'active')
           AND NOT EXISTS (SELECT 1 FROM request_invites x WHERE x.request_id = ?2 AND x.builder_id = ?3)
           AND (SELECT COUNT(*) FROM request_invites x JOIN builders xb ON xb.user_id = x.builder_id JOIN users xu ON xu.id = x.builder_id
                WHERE x.request_id = ?2 AND x.status IN ('invited', 'proposed') AND xb.status = 'approved' AND xu.status = 'active') < ?6
         RETURNING id, builder_id`,
      )
      .bind(inviteIds[i], input.requestId, builderId, input.invitedBy, input.now, MAX_ACTIVE_INVITES),
  );
  // Only this batch's own ids count, so a batch that inserted nothing cannot move the request because another batch invited at the same instant.
  const move = db
    .prepare(
      `UPDATE requests SET status = 'matching', matched_at = COALESCE(matched_at, ?2), updated_at = ?2
       WHERE id = ?1 AND status IN ('submitted', 'matching')
         AND EXISTS (SELECT 1 FROM request_invites WHERE request_id = ?1 AND id IN (SELECT value FROM json_each(?3)))
       RETURNING *`,
    )
    .bind(input.requestId, input.now, JSON.stringify(inviteIds));
  return {
    statements: [...inserts, move],
    inviteIds,
    read: (results) => ({
      request: returnedRequest(results[inserts.length]),
      invited: results.slice(0, inserts.length).flatMap((r) => ((r?.results ?? []) as { id: string; builder_id: string }[]).map((x) => ({ id: x.id, builderId: x.builder_id }))),
    }),
  };
}

/** A client's requests that are still open (submitted or matching): what suspending the client ends. Oldest first. */
export async function listOpenClientRequests(db: D1Database, clientUserId: string): Promise<{ id: string; status: Extract<RequestStatus, "submitted" | "matching"> }[]> {
  const { results } = await db
    .prepare("SELECT id, status FROM requests WHERE client_user_id = ?1 AND status IN ('submitted', 'matching') ORDER BY created_at, id")
    .bind(clientUserId)
    .all<{ id: string; status: Extract<RequestStatus, "submitted" | "matching"> }>();
  return results;
}

type InviteBuilderRow = InviteRow & { builder_name: string; builder_handle: string; builder_public: number };

/** Every invitation of a request with the builder's public name, oldest first. */
export async function listRequestInvites(db: D1Database, requestId: string): Promise<InviteWithBuilder[]> {
  const { results } = await db
    .prepare(
      `SELECT x.*, b.name AS builder_name, b.handle AS builder_handle, (b.status = 'approved' AND u.status = 'active') AS builder_public
       FROM request_invites x JOIN builders b ON b.user_id = x.builder_id JOIN users u ON u.id = b.user_id
       WHERE x.request_id = ?1 -- ulid is not monotonic within one ms, so rowid keeps insertion order
       ORDER BY x.invited_at, x.rowid`,
    )
    .bind(requestId)
    .all<InviteBuilderRow>();
  return results.map((r) => ({ invite: toInvite(r), builderName: r.builder_name, builderHandle: r.builder_handle, builderPublic: r.builder_public === 1 }));
}

/** Removes an unconfirmed request (its confirmation e-mail failed); never touches a confirmed one. */
export function deletePendingRequestStatement(db: D1Database, id: string): D1PreparedStatement {
  return db.prepare("DELETE FROM requests WHERE id = ?1 AND status = 'pending_verification'").bind(id);
}

/** An invitation with its request and both parties' contact details. Used only as recipients and for the e-mail text. */
export type InviteContext = {
  invite: RequestInvite;
  request: ClientRequest;
  /** `public`: the builder is approved on an active account (spec §7.6). */
  builder: { email: string; locale: string; name: string; handle: string; public: boolean };
  client: { email: string; locale: string };
};

export async function findInviteContext(db: D1Database, inviteId: string): Promise<InviteContext | null> {
  const row = await db
    .prepare(
      `SELECT x.*, b.name AS builder_name, b.handle AS builder_handle, bu.email AS builder_email, bu.locale AS builder_locale,
         (b.status = 'approved' AND bu.status = 'active') AS builder_public
       FROM request_invites x JOIN builders b ON b.user_id = x.builder_id JOIN users bu ON bu.id = x.builder_id
       WHERE x.id = ?1`,
    )
    .bind(inviteId)
    .first<InviteRow & { builder_name: string; builder_handle: string; builder_email: string; builder_locale: string; builder_public: number }>();
  if (!row) return null;
  const found = await findRequestWithClient(db, row.request_id);
  if (!found) return null;
  return {
    invite: toInvite(row),
    request: found.request,
    builder: { email: row.builder_email, locale: row.builder_locale, name: row.builder_name, handle: row.builder_handle, public: row.builder_public === 1 },
    client: found.client,
  };
}

const ADMIN_SELECT = `SELECT r.*, u.email AS client_email,
    (SELECT COUNT(*) FROM request_invites x WHERE x.request_id = r.id AND x.status IN ('invited', 'proposed')) AS active_invites,
    (SELECT COUNT(*) FROM request_invites x WHERE x.request_id = r.id) AS total_invites,
    (SELECT COUNT(*) FROM request_invites x WHERE x.request_id = r.id AND x.status IN ('proposed', 'selected', 'not_selected', 'declined')) AS proposals
  FROM requests r JOIN users u ON u.id = r.client_user_id`;
type AdminRow = Row & { client_email: string; active_invites: number; total_invites: number; proposals: number };
const toAdmin = (r: AdminRow): AdminRequest => ({ request: toRequest(r), clientEmail: r.client_email, activeInvites: r.active_invites, totalInvites: r.total_invites, proposals: r.proposals });

/**
 * Spec §5.5 queue: `submitted` and `matching` oldest first (first come, first served); any other filter, and `null`
 * (every status), most recently changed first. Admin only: carries the client's e-mail.
 */
export async function listRequestsForAdmin(db: D1Database, status: RequestStatus | null, limit = 200): Promise<AdminRequest[]> {
  const order = status === "submitted" || status === "matching" ? "ORDER BY COALESCE(r.submitted_at, r.created_at), r.id" : "ORDER BY r.updated_at DESC, r.id DESC";
  const { results } = await db
    .prepare(`${ADMIN_SELECT} WHERE (?1 IS NULL OR r.status = ?1) ${order} LIMIT ?2`)
    .bind(status, limit)
    .all<AdminRow>();
  return results.map(toAdmin);
}

export async function findAdminRequest(db: D1Database, id: string): Promise<AdminRequest | null> {
  const row = await db.prepare(`${ADMIN_SELECT} WHERE r.id = ?1`).bind(id).first<AdminRow>();
  return row ? toAdmin(row) : null;
}

type CandidateRow = { user_id: string; handle: string; name: string; availability: Availability; skills: string; work_languages: string; has_category_product: number; expired_invites: number };

/**
 * Spec §8.10 candidates: approved builders on active accounts, availability not closed, not the client, not yet
 * invited to this request. Scoring is domain/request.ts suggestBuilders (ties by handle, ADR-004: nothing paid).
 * `penaltySince`: expired invitations sent at or after this instant count against the builder. Capped at `limit`
 * builders, taken by user id (Wave 1 scale; revisit before approved builders pass `limit`).
 */
export async function listCandidates(db: D1Database, request: Pick<ClientRequest, "id" | "clientUserId" | "category">, penaltySince: string, limit = 1000): Promise<Candidate[]> {
  const { results } = await db
    .prepare(
      `SELECT b.user_id, b.handle, b.name, b.availability, b.skills, b.work_languages,
         EXISTS (SELECT 1 FROM products p WHERE p.builder_id = b.user_id AND p.status = 'published' AND p.category = ?2) AS has_category_product,
         (SELECT COUNT(*) FROM request_invites e WHERE e.builder_id = b.user_id AND e.status = 'expired' AND e.invited_at >= ?3 AND julianday(e.updated_at) - julianday(e.invited_at) >= 7) AS expired_invites
       FROM builders b JOIN users u ON u.id = b.user_id
       WHERE b.status = 'approved' AND u.status = 'active' AND b.availability != 'closed' AND b.user_id != ?4
         AND NOT EXISTS (SELECT 1 FROM request_invites y WHERE y.request_id = ?1 AND y.builder_id = b.user_id)
       ORDER BY b.user_id LIMIT ?5`,
    )
    .bind(request.id, request.category, penaltySince, request.clientUserId, limit)
    .all<CandidateRow>();
  return results.map((r) => ({
    userId: r.user_id,
    handle: r.handle,
    name: r.name,
    availability: r.availability,
    skills: jsonList(r.skills),
    workLanguages: jsonList(r.work_languages).filter((l): l is WorkLanguage => (WORK_LANGUAGES as readonly string[]).includes(l)),
    hasCategoryProduct: r.has_category_product === 1,
    expiredInvites: r.expired_invites,
  }));
}

/** The builder's Invitations tab, newest first. Requests removed as spam disappear (spec §5.3). */
export async function listBuilderInvitations(db: D1Database, builderId: string, limit = 200): Promise<InvitationListItem[]> {
  const { results } = await db
    .prepare(
      `SELECT x.*, r.title AS request_title, r.category AS request_category, r.status AS request_status
       FROM request_invites x JOIN requests r ON r.id = x.request_id
       WHERE x.builder_id = ?1 AND r.status != 'removed'
       ORDER BY x.invited_at DESC, x.rowid DESC LIMIT ?2`,
    )
    .bind(builderId, limit)
    .all<InviteRow & { request_title: string; request_category: Category; request_status: RequestStatus }>();
  return results.map((r) => ({ invite: toInvite(r), requestTitle: r.request_title, requestCategory: r.request_category, requestStatus: r.request_status }));
}

/** Spec §9: a builder who was not invited cannot see the request; a removed request reads as missing too. */
export async function findBuilderInvitation(db: D1Database, builderId: string, inviteId: string): Promise<Invitation | null> {
  const row = await db.prepare("SELECT * FROM request_invites WHERE id = ?1 AND builder_id = ?2").bind(inviteId, builderId).first<InviteRow>();
  if (!row) return null;
  const request = await findRequestById(db, row.request_id);
  if (!request || request.status === "removed") return null;
  return { invite: toInvite(row), request };
}

/** Spec §5.3 overview: invitations still waiting for this builder's answer. */
export async function countPendingInvitations(db: D1Database, builderId: string): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM request_invites x JOIN requests r ON r.id = x.request_id WHERE x.builder_id = ?1 AND x.status = 'invited' AND r.status = 'matching'")
    .bind(builderId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

// Spec §7.6: the invitation is still `invited`, the request is `matching` and the builder is still approved on an active
// account. Checked inside the statement itself (the architecture test reads upper-case SQL words in comments), so a request closed (or a builder suspended) after the route read it loses.
const ANSWERABLE = `request_invites.status = 'invited'
  AND EXISTS (SELECT 1 FROM requests r WHERE r.id = request_invites.request_id AND r.status = 'matching')
  AND EXISTS (SELECT 1 FROM builders b JOIN users u ON u.id = b.user_id WHERE b.user_id = request_invites.builder_id AND b.status = 'approved' AND u.status = 'active')`;

/** Spec §7.6 propose: invited -> proposed. RETURNING the row, or nothing when it lost. Batch it with a guarded audit row. */
export function proposeStatement(db: D1Database, input: { inviteId: string; builderId: string; proposal: ProposalInput; now: string }): D1PreparedStatement {
  const p = input.proposal;
  return db
    .prepare(
      `UPDATE request_invites SET status = 'proposed', approach = ?3, price_cents = ?4, price_max_cents = ?5, price_note = NULLIF(?6, ''),
         timeline_days = ?7, responded_at = ?8, updated_at = ?8
       WHERE id = ?1 AND builder_id = ?2 AND ${ANSWERABLE}
       RETURNING *`,
    )
    .bind(input.inviteId, input.builderId, p.approach, p.priceCents, p.priceMaxCents, p.priceNote, p.timelineDays, input.now);
}

/** Spec §7.6 decline: invited -> declined with an optional reason (the client never sees it). Same rules as propose. */
export function declineInviteStatement(db: D1Database, input: { inviteId: string; builderId: string; reason: string; now: string }): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE request_invites SET status = 'declined', decline_reason = NULLIF(?3, ''), responded_at = ?4, updated_at = ?4
       WHERE id = ?1 AND builder_id = ?2 AND ${ANSWERABLE}
       RETURNING *`,
    )
    .bind(input.inviteId, input.builderId, input.reason, input.now);
}

export function returnedInvite(result: D1Result | undefined): RequestInvite | null {
  const row = result?.results[0] as InviteRow | undefined;
  return row ? toInvite(row) : null;
}

/**
 * Spec §7.6 select, `between` of endRequestBatch (after the request's compare-and-set and the inquiry INSERTs):
 * proposed -> selected, linked to the new inquiry, only when this batch won. RETURNING the row.
 */
export function markInviteSelectedStatement(db: D1Database, input: { inviteId: string; requestId: string; inquiryId: string; now: string }): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE request_invites SET status = 'selected', inquiry_id = ?3, updated_at = ?4
       WHERE id = ?1 AND request_id = ?2 AND status = 'proposed'
         AND EXISTS (SELECT 1 FROM requests WHERE id = ?2 AND status = 'builder_selected' AND selected_invite_id = ?1 AND updated_at = ?4)
         AND EXISTS (SELECT 1 FROM inquiries WHERE id = ?3)
       RETURNING id`,
    )
    .bind(input.inviteId, input.requestId, input.inquiryId, input.now);
}

/** Sanity bound on rows one daily run takes from a list; the daily job warns when it is hit. */
export const CRON_LIST_CAP = 200;

/**
 * Spec §8.4: invitations sent before `invitedBefore` that are still unanswered lapse (invited -> expired). Returns their ids
 * for the "invitation ended" e-mail. `now >= invited_at + 7 days` holds for every row, so each one counts as a lapse in the
 * §8.10 penalty (julianday(updated_at) - julianday(invited_at) >= 7); the cron must not call this with a shorter window.
 */
export async function expireStaleInvites(db: D1Database, invitedBefore: string, now: string): Promise<ExpiredInvite[]> {
  const { results } = await db
    .prepare("UPDATE request_invites SET status = 'expired', updated_at = ?2 WHERE status = 'invited' AND invited_at < ?1 RETURNING id, request_id")
    .bind(invitedBefore, now)
    .all<{ id: string; request_id: string }>();
  return results.map((r) => ({ id: r.id, requestId: r.request_id }));
}

/** An invitation a system-driven sweep just moved to expired; the caller audits each one (`inviteExpiryAuditStatements`). */
export type ExpiredInvite = { id: string; requestId: string };

/** The rows a batched sweep statement returned (`RETURNING id, request_id`). */
export function expiredInvites(result: D1Result | undefined): ExpiredInvite[] {
  return ((result?.results ?? []) as { id: string; request_id: string }[]).map((r) => ({ id: r.id, requestId: r.request_id }));
}

/**
 * Spec §7.6: a builder who is not approved on an active account loses their unanswered invitations (invited -> expired),
 * with no e-mail (Owner 2026-10-04). Checks the builder's CURRENT status itself, so it is safe to batch right after the
 * change that suspended them, or to run for everyone (no `builderId`) from the daily job. `updated_at = now` of the
 * suspension: a suspension before day 7 is not a lapse for the §8.10 penalty.
 */
export function expireInvitesOfInactiveBuildersStatement(db: D1Database, now: string, builderId: string | null = null): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE request_invites SET status = 'expired', updated_at = ?1
       WHERE status = 'invited' AND (?2 IS NULL OR builder_id = ?2)
         AND builder_id IN (SELECT b.user_id FROM builders b JOIN users u ON u.id = b.user_id WHERE b.status != 'approved' OR u.status != 'active')
       RETURNING id, request_id`,
    )
    .bind(now, builderId);
}

export async function expireInvitesOfInactiveBuilders(db: D1Database, now: string, builderId: string | null = null): Promise<ExpiredInvite[]> {
  return expiredInvites(await expireInvitesOfInactiveBuildersStatement(db, now, builderId).all());
}

/** Spec §8.4: unanswered invitations sent before `invitedBefore`, not yet reminded, on a matching request, to a public builder. */
export async function listInvitesToRemind(db: D1Database, invitedBefore: string, limit = CRON_LIST_CAP): Promise<string[]> {
  const { results } = await db
    .prepare(
      `SELECT x.id FROM request_invites x
       JOIN requests r ON r.id = x.request_id
       JOIN builders b ON b.user_id = x.builder_id JOIN users u ON u.id = b.user_id
       WHERE x.status = 'invited' AND x.reminded_at IS NULL AND x.invited_at < ?1 AND r.status = 'matching'
         AND b.status = 'approved' AND u.status = 'active'
       ORDER BY x.invited_at, x.id LIMIT ?2`,
    )
    .bind(invitedBefore, limit)
    .all<{ id: string }>();
  return results.map((r) => r.id);
}

/** Set once, after the reminder went out (does not touch updated_at: only expiry stamps it). */
export async function markInviteReminded(db: D1Database, id: string, now: string): Promise<void> {
  await db.prepare("UPDATE request_invites SET reminded_at = ?2 WHERE id = ?1 AND reminded_at IS NULL").bind(id, now).run();
}

/** Spec §8.4: matching requests whose first invitation (matched_at) went out before `matchedBefore`. Oldest first. */
export async function listRequestsToExpire(db: D1Database, matchedBefore: string, limit = CRON_LIST_CAP): Promise<string[]> {
  const { results } = await db
    .prepare("SELECT id FROM requests WHERE status = 'matching' AND matched_at < ?1 ORDER BY matched_at, id LIMIT ?2")
    .bind(matchedBefore, limit)
    .all<{ id: string }>();
  return results.map((r) => r.id);
}

/**
 * Spec §8.4: requests never confirmed (submitted_at IS NULL, stamped on the first move to submitted) and created before
 * `cutoff` go away (they never have invitations), including one an admin moved to `removed` meanwhile (Owner, M6 review F4):
 * the Privacy page promises 48 hours. A request that was ever confirmed is never deleted. Returns how many.
 */
export async function deleteExpiredPendingRequests(db: D1Database, cutoff: string): Promise<number> {
  const { results } = await db.prepare("DELETE FROM requests WHERE submitted_at IS NULL AND status IN ('pending_verification', 'removed') AND created_at < ?1 RETURNING id").bind(cutoff).all();
  return results.length;
}
