import { WORK_LANGUAGES, type WorkLanguage } from "../domain/builder.ts";
import type { BudgetBand } from "../domain/inquiry.ts";
import type { Category } from "../domain/product.ts";
import {
  MAX_ACTIVE_INVITES,
  type InviteStatus,
  type InviteWithBuilder,
  type ClientRequest,
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
 * approved on an active account, the request is not submitted/matching, or 5 invitations are already active. The cap
 * is checked inside each INSERT, so concurrent admins cannot pass it. Then the request moves to matching, only if this
 * batch invited someone (matched_at keeps the first invitation's time).
 */
export function inviteBuildersBatch(
  db: D1Database,
  input: { requestId: string; builderIds: string[]; invitedBy: string; now: string },
): { statements: D1PreparedStatement[]; read: (results: D1Result[]) => { request: ClientRequest | null; invited: { id: string; builderId: string }[] } } {
  const at = Date.parse(input.now);
  const inserts = input.builderIds.map((builderId) =>
    db
      .prepare(
        `INSERT INTO request_invites (id, request_id, builder_id, invited_by, status, invited_at, created_at, updated_at)
         SELECT ?1, ?2, ?3, ?4, 'invited', ?5, ?5, ?5
         WHERE EXISTS (SELECT 1 FROM requests r WHERE r.id = ?2 AND r.status IN ('submitted', 'matching') AND r.client_user_id != ?3)
           AND EXISTS (SELECT 1 FROM builders b JOIN users u ON u.id = b.user_id WHERE b.user_id = ?3 AND b.status = 'approved' AND u.status = 'active')
           AND NOT EXISTS (SELECT 1 FROM request_invites x WHERE x.request_id = ?2 AND x.builder_id = ?3)
           AND (SELECT COUNT(*) FROM request_invites x WHERE x.request_id = ?2 AND x.status IN ('invited', 'proposed')) < ?6
         RETURNING id, builder_id`,
      )
      .bind(ulid(at), input.requestId, builderId, input.invitedBy, input.now, MAX_ACTIVE_INVITES),
  );
  const move = db
    .prepare(
      `UPDATE requests SET status = 'matching', matched_at = COALESCE(matched_at, ?2), updated_at = ?2
       WHERE id = ?1 AND status IN ('submitted', 'matching') AND EXISTS (SELECT 1 FROM request_invites WHERE request_id = ?1 AND invited_at = ?2)
       RETURNING *`,
    )
    .bind(input.requestId, input.now);
  return {
    statements: [...inserts, move],
    read: (results) => ({
      request: returnedRequest(results[inserts.length]),
      invited: results.slice(0, inserts.length).flatMap((r) => ((r?.results ?? []) as { id: string; builder_id: string }[]).map((x) => ({ id: x.id, builderId: x.builder_id }))),
    }),
  };
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
