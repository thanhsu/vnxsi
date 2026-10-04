import { MAX_NOTIFY_ATTEMPTS, type AdminInquiry, type BudgetBand, type Inquiry, type InquiryMessage, type InquiryStatus, type InquirySummary, type InquiryType, type MessageKind } from "../domain/inquiry.ts";
import { ulid } from "../lib/ulid.ts";

type Row = {
  id: string;
  client_user_id: string;
  client_name: string;
  builder_id: string;
  product_id: string | null;
  request_id: string | null;
  type: InquiryType;
  message: string;
  budget_band: BudgetBand;
  deadline: string | null;
  status: InquiryStatus;
  locale: string;
  opened_at: string | null;
  last_activity_at: string;
  builder_reminded_at: string | null;
  admin_alerted_at: string | null;
  created_at: string;
  updated_at: string;
};

export function toInquiry(r: Row): Inquiry {
  return {
    id: r.id,
    clientUserId: r.client_user_id,
    clientName: r.client_name,
    builderId: r.builder_id,
    productId: r.product_id,
    requestId: r.request_id,
    type: r.type,
    message: r.message,
    budgetBand: r.budget_band,
    deadline: r.deadline,
    status: r.status,
    locale: r.locale,
    openedAt: r.opened_at,
    lastActivityAt: r.last_activity_at,
    builderRemindedAt: r.builder_reminded_at,
    adminAlertedAt: r.admin_alerted_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

type MessageRow = { id: string; inquiry_id: string; sender_user_id: string; kind: MessageKind; body: string; created_at: string; notified_at: string | null; notify_attempts: number };

const toMessage = (r: MessageRow): InquiryMessage => ({
  id: r.id,
  inquiryId: r.inquiry_id,
  senderUserId: r.sender_user_id,
  kind: r.kind,
  body: r.body,
  createdAt: r.created_at,
  notifiedAt: r.notified_at,
  notifyAttempts: r.notify_attempts,
});

/** "This request's compare-and-set on the inquiry went through": statements batched after it check this. */
export type InquiryGuard = { inquiryId: string; status: InquiryStatus; updatedAt: string };

export type NewInquiry = {
  clientUserId: string;
  clientName: string;
  builderId: string;
  productId: string | null;
  requestId?: string | null;
  type: InquiryType;
  message: string;
  budgetBand: BudgetBand;
  deadline: string | null;
  status: "open" | "pending_verification";
  locale: string;
  now: string;
};


/** M6: the inquiry is written only when the same batch just moved the request to builder_selected for this invite, which is still `proposed`. */
export type SelectedRequestGuard = { requestId: string; inviteId: string; updatedAt: string };

/** The inquiry and its first message as statements; with a guard, nothing is written unless the guard holds. */
export function createInquiryStatements(db: D1Database, input: NewInquiry, onlyIf?: SelectedRequestGuard): { statements: D1PreparedStatement[]; id: string; firstMessageId: string } {
  const at = Date.parse(input.now);
  const id = ulid(at);
  const firstMessageId = ulid(at);
  const guard = onlyIf ? "WHERE EXISTS (SELECT 1 FROM requests WHERE id = ?14 AND status = 'builder_selected' AND selected_invite_id = ?15 AND updated_at = ?16) AND EXISTS (SELECT 1 FROM request_invites WHERE id = ?15 AND request_id = ?14 AND builder_id = ?4 AND status = 'proposed')" : "";
  const insert = db
    .prepare(
      `INSERT INTO inquiries (id, client_user_id, client_name, builder_id, product_id, request_id, type, message, budget_band, deadline, status, locale,
         opened_at, last_activity_at, created_at, updated_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, CASE WHEN ?11 = 'open' THEN ?13 END, ?13, ?13, ?13 ${guard}
       RETURNING *`,
    )
    .bind(
      id, input.clientUserId, input.clientName, input.builderId, input.productId, input.requestId ?? null, input.type, input.message, input.budgetBand, input.deadline, input.status, input.locale, input.now,
      ...(onlyIf ? [onlyIf.requestId, onlyIf.inviteId, onlyIf.updatedAt] : []),
    );
  const message = db
    .prepare(
      `INSERT INTO inquiry_messages (id, inquiry_id, sender_user_id, kind, body, created_at)
       SELECT ?1, ?2, ?3, 'message', ?4, ?5 WHERE EXISTS (SELECT 1 FROM inquiries WHERE id = ?2)`,
    )
    .bind(firstMessageId, id, input.clientUserId, input.message, input.now);
  return { statements: [insert, message], id, firstMessageId };
}

/** The inquiry and its first message (the client's text; its notification tells the builder) in one transaction. */
export async function createInquiry(db: D1Database, input: NewInquiry): Promise<{ inquiry: Inquiry; firstMessageId: string }> {
  const { statements, firstMessageId } = createInquiryStatements(db, input);
  const [rows] = await db.batch(statements);
  const row = rows?.results[0] as Row | undefined;
  if (!row) throw new Error("inquiry insert failed");
  return { inquiry: toInquiry(row), firstMessageId };
}

export async function findInquiryById(db: D1Database, id: string): Promise<Inquiry | null> {
  const row = await db.prepare("SELECT * FROM inquiries WHERE id = ?1").bind(id).first<Row>();
  return row ? toInquiry(row) : null;
}

type SummaryRow = Row & { product_name: string | null; product_slug: string | null; request_title: string | null; builder_name: string; builder_handle: string };

const SUMMARY = `SELECT i.*, p.name AS product_name, p.slug AS product_slug, rq.title AS request_title, b.name AS builder_name, b.handle AS builder_handle
  FROM inquiries i JOIN builders b ON b.user_id = i.builder_id LEFT JOIN products p ON p.id = i.product_id LEFT JOIN requests rq ON rq.id = i.request_id`;

const toSummary = (r: SummaryRow): InquirySummary => ({ inquiry: toInquiry(r), productName: r.product_name, productSlug: r.product_slug, requestTitle: r.request_title ?? null, builderName: r.builder_name, builderHandle: r.builder_handle });

// Spec §5.3/§5.4: builders never see unconfirmed or removed inquiries; clients never see removed ones.
const BUILDER_VISIBLE = "i.status NOT IN ('pending_verification', 'removed')";
const CLIENT_VISIBLE = "i.status != 'removed'";

export async function findBuilderInquiry(db: D1Database, builderId: string, id: string): Promise<InquirySummary | null> {
  const row = await db.prepare(`${SUMMARY} WHERE i.id = ?1 AND i.builder_id = ?2 AND ${BUILDER_VISIBLE}`).bind(id, builderId).first<SummaryRow>();
  return row ? toSummary(row) : null;
}

export async function findClientInquiry(db: D1Database, clientUserId: string, id: string): Promise<InquirySummary | null> {
  const row = await db.prepare(`${SUMMARY} WHERE i.id = ?1 AND i.client_user_id = ?2 AND ${CLIENT_VISIBLE}`).bind(id, clientUserId).first<SummaryRow>();
  return row ? toSummary(row) : null;
}

/** Most recent activity first. */
export async function listBuilderInquiries(db: D1Database, builderId: string, limit = 200): Promise<InquirySummary[]> {
  const { results } = await db
    .prepare(`${SUMMARY} WHERE i.builder_id = ?1 AND ${BUILDER_VISIBLE} ORDER BY i.last_activity_at DESC, i.id DESC LIMIT ?2`)
    .bind(builderId, limit)
    .all<SummaryRow>();
  return results.map(toSummary);
}

export async function listClientInquiries(db: D1Database, clientUserId: string, limit = 200): Promise<InquirySummary[]> {
  const { results } = await db
    .prepare(`${SUMMARY} WHERE i.client_user_id = ?1 AND ${CLIENT_VISIBLE} ORDER BY i.last_activity_at DESC, i.id DESC LIMIT ?2`)
    .bind(clientUserId, limit)
    .all<SummaryRow>();
  return results.map(toSummary);
}

/** Admin list (spec §5.5), newest first; the admin may see the client's e-mail. */
export async function listInquiriesForAdmin(db: D1Database, status: InquiryStatus | null, limit = 200): Promise<AdminInquiry[]> {
  const { results } = await db
    .prepare(
      `SELECT i.*, p.name AS product_name, p.slug AS product_slug, rq.title AS request_title, b.name AS builder_name, b.handle AS builder_handle, u.email AS client_email
       FROM inquiries i JOIN builders b ON b.user_id = i.builder_id JOIN users u ON u.id = i.client_user_id LEFT JOIN products p ON p.id = i.product_id LEFT JOIN requests rq ON rq.id = i.request_id
       WHERE (?1 IS NULL OR i.status = ?1) ORDER BY i.created_at DESC, i.id DESC LIMIT ?2`,
    )
    .bind(status, limit)
    .all<SummaryRow & { client_email: string }>();
  return results.map((r) => ({ ...toSummary(r), clientEmail: r.client_email }));
}

export async function countOpenInquiries(db: D1Database, builderId: string): Promise<number> {
  const row = await db.prepare("SELECT COUNT(*) AS n FROM inquiries WHERE builder_id = ?1 AND status = 'open'").bind(builderId).first<{ n: number }>();
  return row?.n ?? 0;
}

export async function listMessages(db: D1Database, inquiryId: string): Promise<InquiryMessage[]> {
  const { results } = await db.prepare("SELECT * FROM inquiry_messages WHERE inquiry_id = ?1 ORDER BY created_at, id").bind(inquiryId).all<MessageRow>();
  return results.map(toMessage);
}

/**
 * Compare-and-set on status, as a statement for db.batch. Every change also counts as activity; the first move to
 * "open" stamps opened_at. Returns the row (RETURNING), or nothing when the status was no longer `from`.
 */
export function setInquiryStatusStatement(db: D1Database, input: { id: string; from: InquiryStatus; to: InquiryStatus; now: string }): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE inquiries SET status = ?3, updated_at = ?4, last_activity_at = ?4,
         opened_at = CASE WHEN ?3 = 'open' THEN COALESCE(opened_at, ?4) ELSE opened_at END
       WHERE id = ?1 AND status = ?2
       RETURNING *`,
    )
    .bind(input.id, input.from, input.to, input.now);
}

/** The inquiry a batched setInquiryStatusStatement returned, or null when its compare-and-set lost. */
export function returnedInquiry(result: D1Result | undefined): Inquiry | null {
  const row = result?.results[0] as Row | undefined;
  return row ? toInquiry(row) : null;
}

export async function setInquiryStatus(db: D1Database, input: { id: string; from: InquiryStatus; to: InquiryStatus; now: string }): Promise<Inquiry | null> {
  const row = await setInquiryStatusStatement(db, input).first<Row>();
  return row ? toInquiry(row) : null;
}

/** A message, written only when the same batch's compare-and-set left the inquiry as `guard` says. */
export function addMessageStatement(
  db: D1Database,
  input: { inquiryId: string; senderUserId: string; kind: MessageKind; body: string; now: string },
  guard: InquiryGuard,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO inquiry_messages (id, inquiry_id, sender_user_id, kind, body, created_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6
       WHERE EXISTS (SELECT 1 FROM inquiries WHERE id = ?7 AND status = ?8 AND updated_at = ?9)
       RETURNING id`,
    )
    .bind(ulid(Date.parse(input.now)), input.inquiryId, input.senderUserId, input.kind, input.body, input.now, guard.inquiryId, guard.status, guard.updatedAt);
}

/** Removes an unconfirmed inquiry and its messages; never touches one that has been confirmed. */
export function deletePendingInquiryStatements(db: D1Database, id: string): D1PreparedStatement[] {
  return [
    db.prepare("DELETE FROM inquiry_messages WHERE inquiry_id = ?1 AND EXISTS (SELECT 1 FROM inquiries WHERE id = ?1 AND status = 'pending_verification')").bind(id),
    db.prepare("DELETE FROM inquiries WHERE id = ?1 AND status = 'pending_verification'").bind(id),
  ];
}

/**
 * Spec §8.4: inquiries never confirmed (opened_at IS NULL, stamped when one first becomes `open`) and created before `cutoff`
 * go away, including one an admin moved to `removed` meanwhile (Owner, M6 review F4). One that was ever opened is kept.
 * Returns how many inquiries were deleted.
 */
export async function deleteExpiredPendingInquiries(db: D1Database, cutoff: string): Promise<number> {
  const never = "opened_at IS NULL AND status IN ('pending_verification', 'removed') AND created_at < ?1";
  const [, inquiries] = await db.batch([
    db.prepare(`DELETE FROM inquiry_messages WHERE inquiry_id IN (SELECT id FROM inquiries WHERE ${never})`).bind(cutoff),
    db.prepare(`DELETE FROM inquiries WHERE ${never}`).bind(cutoff),
  ]);
  return inquiries?.meta.changes ?? 0;
}

export type Party = { userId: string; email: string; locale: string };

export type MessageContext = {
  message: InquiryMessage;
  summary: InquirySummary;
  /** The client's first message, which opens the inquiry for the builder. */
  isFirst: boolean;
  client: Party;
  builder: Party;
};

type ContextRow = SummaryRow & {
  m_id: string;
  m_inquiry_id: string;
  m_sender_user_id: string;
  m_kind: MessageKind;
  m_body: string;
  m_created_at: string;
  m_notified_at: string | null;
  m_notify_attempts: number;
  client_email: string;
  client_locale: string;
  builder_email: string;
  builder_locale: string;
  first_id: string;
};

/** Everything a notification for this message needs. Both e-mails are loaded here and used only as recipients. */
export async function findMessageContext(db: D1Database, messageId: string): Promise<MessageContext | null> {
  const r = await db
    .prepare(
      `SELECT m.id AS m_id, m.inquiry_id AS m_inquiry_id, m.sender_user_id AS m_sender_user_id, m.kind AS m_kind, m.body AS m_body,
         m.created_at AS m_created_at, m.notified_at AS m_notified_at, m.notify_attempts AS m_notify_attempts,
         i.*, p.name AS product_name, p.slug AS product_slug, rq.title AS request_title, b.name AS builder_name, b.handle AS builder_handle,
         cu.email AS client_email, cu.locale AS client_locale, bu.email AS builder_email, bu.locale AS builder_locale,
         (SELECT f.id FROM inquiry_messages f WHERE f.inquiry_id = i.id ORDER BY f.created_at, f.id LIMIT 1) AS first_id
       FROM inquiry_messages m
       JOIN inquiries i ON i.id = m.inquiry_id
       JOIN builders b ON b.user_id = i.builder_id
       JOIN users cu ON cu.id = i.client_user_id
       JOIN users bu ON bu.id = i.builder_id
       LEFT JOIN products p ON p.id = i.product_id
       LEFT JOIN requests rq ON rq.id = i.request_id
       WHERE m.id = ?1`,
    )
    .bind(messageId)
    .first<ContextRow>();
  if (!r) return null;
  return {
    message: toMessage({ id: r.m_id, inquiry_id: r.m_inquiry_id, sender_user_id: r.m_sender_user_id, kind: r.m_kind, body: r.m_body, created_at: r.m_created_at, notified_at: r.m_notified_at, notify_attempts: r.m_notify_attempts }),
    summary: toSummary(r),
    isFirst: r.first_id === r.m_id,
    client: { userId: r.client_user_id, email: r.client_email, locale: r.client_locale },
    builder: { userId: r.builder_id, email: r.builder_email, locale: r.builder_locale },
  };
}

export async function markMessageNotified(db: D1Database, messageId: string, now: string): Promise<void> {
  await db.prepare("UPDATE inquiry_messages SET notified_at = ?2 WHERE id = ?1 AND notified_at IS NULL").bind(messageId, now).run();
}

/** Counts one failed send; returns the attempts so far. */
export async function recordNotifyFailure(db: D1Database, messageId: string): Promise<number> {
  const row = await db
    .prepare("UPDATE inquiry_messages SET notify_attempts = notify_attempts + 1 WHERE id = ?1 RETURNING notify_attempts")
    .bind(messageId)
    .first<{ notify_attempts: number }>();
  return row?.notify_attempts ?? 0;
}

/** Messages whose notification is still due (spec §8.3): unsent, under the attempt cap, on a confirmed, non-removed inquiry. */
export async function listUnnotifiedMessages(db: D1Database, limit = 100): Promise<InquiryMessage[]> {
  const { results } = await db
    .prepare(
      `SELECT m.* FROM inquiry_messages m JOIN inquiries i ON i.id = m.inquiry_id
       WHERE m.notified_at IS NULL AND m.notify_attempts < ?1 AND i.status NOT IN ('pending_verification', 'removed')
       ORDER BY m.created_at, m.id LIMIT ?2`,
    )
    .bind(MAX_NOTIFY_ATTEMPTS, limit)
    .all<MessageRow>();
  return results.map(toMessage);
}

/** Spec §8.4: open (unanswered) inquiries opened before `openedBefore` whose builder has not been reminded. */
export async function listInquiriesToRemind(db: D1Database, openedBefore: string, limit = 200): Promise<InquirySummary[]> {
  const { results } = await db
    .prepare(`${SUMMARY} WHERE i.status = 'open' AND b.status = 'approved' AND i.opened_at < ?1 AND i.builder_reminded_at IS NULL ORDER BY i.opened_at, i.id LIMIT ?2`)
    .bind(openedBefore, limit)
    .all<SummaryRow>();
  return results.map(toSummary);
}

export async function markReminded(db: D1Database, id: string, now: string): Promise<void> {
  await db.prepare("UPDATE inquiries SET builder_reminded_at = ?2 WHERE id = ?1 AND builder_reminded_at IS NULL").bind(id, now).run();
}

/** Spec §8.4: open inquiries opened before `openedBefore` the admins have not been told about. */
export async function listInquiriesToAlert(db: D1Database, openedBefore: string, limit = 200): Promise<InquirySummary[]> {
  const { results } = await db
    .prepare(`${SUMMARY} WHERE i.status = 'open' AND i.opened_at < ?1 AND i.admin_alerted_at IS NULL ORDER BY i.opened_at, i.id LIMIT ?2`)
    .bind(openedBefore, limit)
    .all<SummaryRow>();
  return results.map(toSummary);
}

export async function markAlerted(db: D1Database, ids: string[], now: string): Promise<void> {
  if (ids.length === 0) return;
  await db.batch(ids.map((id) => db.prepare("UPDATE inquiries SET admin_alerted_at = ?2 WHERE id = ?1 AND admin_alerted_at IS NULL").bind(id, now)));
}
