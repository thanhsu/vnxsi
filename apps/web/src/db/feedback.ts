import type { Feedback, FeedbackKind, FeedbackRole, FeedbackStatus } from "../domain/feedback.ts";
import { ulid } from "../lib/ulid.ts";

/** The only writer of `feedback` (module `contact`, plan VNX-0710). */

type Row = {
  id: string;
  role: FeedbackRole;
  kind: FeedbackKind;
  name: string | null;
  email: string;
  message: string;
  locale: string;
  user_id: string | null;
  status: FeedbackStatus;
  notified_at: string | null;
  handled_at: string | null;
  handled_by: string | null;
  created_at: string;
  updated_at: string;
};

const toFeedback = (r: Row): Feedback => ({
  id: r.id,
  role: r.role,
  kind: r.kind,
  name: r.name,
  email: r.email,
  message: r.message,
  locale: r.locale,
  userId: r.user_id,
  status: r.status,
  notifiedAt: r.notified_at,
  handledAt: r.handled_at,
  handledBy: r.handled_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export type NewFeedback = {
  role: FeedbackRole;
  kind: FeedbackKind;
  name: string | null;
  email: string;
  message: string;
  locale: string;
  userId: string | null;
  now: string;
};

export async function createFeedback(db: D1Database, input: NewFeedback): Promise<Feedback> {
  const row = await db
    .prepare(
      `INSERT INTO feedback (id, role, kind, name, email, message, locale, user_id, status, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'new', ?9, ?9)
       RETURNING *`,
    )
    .bind(ulid(Date.parse(input.now)), input.role, input.kind, input.name, input.email, input.message, input.locale, input.userId, input.now)
    .first<Row>();
  if (!row) throw new Error("feedback insert returned no row");
  return toFeedback(row);
}

/** The e-mail to contact@vnx.si went out. */
export async function markFeedbackNotified(db: D1Database, id: string, now: string): Promise<void> {
  await db.prepare("UPDATE feedback SET notified_at = ?2 WHERE id = ?1").bind(id, now).run();
}

export async function findFeedbackById(db: D1Database, id: string): Promise<Feedback | null> {
  const row = await db.prepare("SELECT * FROM feedback WHERE id = ?1").bind(id).first<Row>();
  return row ? toFeedback(row) : null;
}

/** Newest first. */
export async function listFeedback(db: D1Database, status: FeedbackStatus, page: { limit: number; offset: number }): Promise<Feedback[]> {
  const rows = await db
    .prepare("SELECT * FROM feedback WHERE status = ?1 ORDER BY created_at DESC, id DESC LIMIT ?2 OFFSET ?3")
    .bind(status, page.limit, page.offset)
    .all<Row>();
  return rows.results.map(toFeedback);
}

export async function countFeedback(db: D1Database, status: FeedbackStatus): Promise<number> {
  const row = await db.prepare("SELECT COUNT(*) AS n FROM feedback WHERE status = ?1").bind(status).first<{ n: number }>();
  return row?.n ?? 0;
}

/** "This request's compare-and-set on the feedback row went through": audit rows batched after it check this. */
export type FeedbackGuard = { feedbackId: string; status: FeedbackStatus; updatedAt: string };

/**
 * Compare-and-set of the status, as a statement for a db.batch with its audit row. Changes nothing (and returns no
 * row) unless the row is still in `from`. Handling or marking as spam records who and when; reopening clears both.
 */
export function setFeedbackStatusStatement(db: D1Database, input: { id: string; from: FeedbackStatus; to: FeedbackStatus; by: string; now: string }): D1PreparedStatement {
  const handled = input.to === "new" ? null : input.now;
  const by = input.to === "new" ? null : input.by;
  return db
    .prepare("UPDATE feedback SET status = ?3, handled_at = ?4, handled_by = ?5, updated_at = ?6 WHERE id = ?1 AND status = ?2 RETURNING id")
    .bind(input.id, input.from, input.to, handled, by, input.now);
}
