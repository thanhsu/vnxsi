import type { BadgeKind } from "../domain/product.ts";
import { ulid } from "../lib/ulid.ts";
import type { FeedbackGuard } from "./feedback.ts";
import type { InquiryGuard } from "./inquiries.ts";
import type { ProductGuard } from "./products.ts";
import type { InviteGuard, RequestGuard } from "./requests.ts";

export type AuditInput = { actorUserId: string | null; action: string; entity: string; entityId: string | null; data?: Record<string, unknown>; now: string };

/** Written only when that user currently has this status and was last updated at that instant. */
export type AuditUserGuard = { userId: string; status: string; updatedAt: string };
/**
 * Written only when the batch's product compare-and-set went through (see ProductGuard) and, with `revoked`, only when
 * the same batch revoked an active badge of that kind (its revoked_at is this audit row's `now`).
 */
export type AuditProductGuard = ProductGuard & { revoked?: BadgeKind };
/** Written only when the batch's inquiry compare-and-set went through (see InquiryGuard). */
export type AuditInquiryGuard = InquiryGuard;
/** Written only when the batch's request compare-and-set went through (see RequestGuard). */
export type AuditRequestGuard = RequestGuard;
/** Written only when the same batch inserted at least one of these invitation ids (see inviteBuildersBatch). */
export type AuditInvitesGuard = { requestId: string; inviteIds: string[] };
/** Written only when the batch's invitation compare-and-set went through (see InviteGuard). */
export type AuditInviteGuard = InviteGuard;
/** Written only when the batch's feedback compare-and-set went through (see FeedbackGuard, VNX-0710). */
export type AuditFeedbackGuard = FeedbackGuard;
/** Written only when that feature flag row's last write carries this write id, i.e. this batch's upsert changed it (see setFlag). */
export type AuditFlagGuard = { flagKey: string; writeId: string };
/** Written only when that merchant / program / offer row's last write carries this write id, i.e. this batch's statement created or changed it (see runAudited). Reads the table only for that. */
export type AuditPartnerGuard = { partnerTable: "merchants" | "partner_programs" | "offers"; id: string; writeId: string };

/**
 * The audit INSERT as a statement, so a route can commit it in one db.batch with the change it records.
 * With a guard the row is written only when the same batch's compare-and-set went through (a lost compare-and-set
 * writes no audit row): `userId` guards on the user's status, `productId` on the product's, `inquiryId` on the inquiry's, `requestId` on the request's,
 * `inviteId` on the invitation's, `feedbackId` on the feedback row's, `flagKey` on the feature flag's last write id,
 * `partnerTable` + `id` on that merchant / program / offer row's last write id.
 */
export function auditStatement(
  db: D1Database,
  input: AuditInput,
  onlyIf?: AuditUserGuard | AuditProductGuard | AuditInquiryGuard | AuditRequestGuard | AuditInvitesGuard | AuditInviteGuard | AuditFeedbackGuard | AuditFlagGuard | AuditPartnerGuard,
): D1PreparedStatement {
  const id = ulid(Date.parse(input.now));
  const data = JSON.stringify(input.data ?? {});
  const values = [id, input.actorUserId, input.action, input.entity, input.entityId, data, input.now];
  if (!onlyIf) {
    return db.prepare("INSERT INTO audit_log (id, actor_user_id, action, entity, entity_id, data, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)").bind(...values);
  }
  if ("userId" in onlyIf) {
    return db
      .prepare(
        `INSERT INTO audit_log (id, actor_user_id, action, entity, entity_id, data, created_at)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7
         WHERE EXISTS (SELECT 1 FROM users WHERE id = ?8 AND status = ?9 AND updated_at = ?10)`,
      )
      .bind(...values, onlyIf.userId, onlyIf.status, onlyIf.updatedAt);
  }
  if ("inquiryId" in onlyIf) {
    return db
      .prepare(
        `INSERT INTO audit_log (id, actor_user_id, action, entity, entity_id, data, created_at)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7
         WHERE EXISTS (SELECT 1 FROM inquiries WHERE id = ?8 AND status = ?9 AND updated_at = ?10)`,
      )
      .bind(...values, onlyIf.inquiryId, onlyIf.status, onlyIf.updatedAt);
  }
  if ("inviteIds" in onlyIf) {
    return db
      .prepare(
        `INSERT INTO audit_log (id, actor_user_id, action, entity, entity_id, data, created_at)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7
         WHERE EXISTS (SELECT 1 FROM request_invites WHERE request_id = ?8 AND id IN (SELECT value FROM json_each(?9)))`,
      )
      .bind(...values, onlyIf.requestId, JSON.stringify(onlyIf.inviteIds));
  }
  if ("requestId" in onlyIf) {
    return db
      .prepare(
        `INSERT INTO audit_log (id, actor_user_id, action, entity, entity_id, data, created_at)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7
         WHERE EXISTS (SELECT 1 FROM requests WHERE id = ?8 AND status = ?9 AND updated_at = ?10)`,
      )
      .bind(...values, onlyIf.requestId, onlyIf.status, onlyIf.updatedAt);
  }
  if ("inviteId" in onlyIf) {
    return db
      .prepare(
        `INSERT INTO audit_log (id, actor_user_id, action, entity, entity_id, data, created_at)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7
         WHERE EXISTS (SELECT 1 FROM request_invites WHERE id = ?8 AND status = ?9 AND updated_at = ?10)`,
      )
      .bind(...values, onlyIf.inviteId, onlyIf.status, onlyIf.updatedAt);
  }
  if ("feedbackId" in onlyIf) {
    return db
      .prepare(
        `INSERT INTO audit_log (id, actor_user_id, action, entity, entity_id, data, created_at)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7
         WHERE EXISTS (SELECT 1 FROM feedback WHERE id = ?8 AND status = ?9 AND updated_at = ?10)`,
      )
      .bind(...values, onlyIf.feedbackId, onlyIf.status, onlyIf.updatedAt);
  }
  if ("flagKey" in onlyIf) {
    return db
      .prepare(
        `INSERT INTO audit_log (id, actor_user_id, action, entity, entity_id, data, created_at)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7
         WHERE EXISTS (SELECT 1 FROM feature_flags WHERE key = ?8 AND write_id = ?9)`,
      )
      .bind(...values, onlyIf.flagKey, onlyIf.writeId);
  }
  if ("partnerTable" in onlyIf) {
    if (onlyIf.partnerTable === "merchants") {
      return db
        .prepare(
          `INSERT INTO audit_log (id, actor_user_id, action, entity, entity_id, data, created_at)
           SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7
           WHERE EXISTS (SELECT 1 FROM merchants WHERE id = ?8 AND write_id = ?9)`,
        )
        .bind(...values, onlyIf.id, onlyIf.writeId);
    }
    if (onlyIf.partnerTable === "offers") {
      return db
        .prepare(
          `INSERT INTO audit_log (id, actor_user_id, action, entity, entity_id, data, created_at)
           SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7
           WHERE EXISTS (SELECT 1 FROM offers WHERE id = ?8 AND write_id = ?9)`,
        )
        .bind(...values, onlyIf.id, onlyIf.writeId);
    }
    return db
      .prepare(
        `INSERT INTO audit_log (id, actor_user_id, action, entity, entity_id, data, created_at)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7
         WHERE EXISTS (SELECT 1 FROM partner_programs WHERE id = ?8 AND write_id = ?9)`,
      )
      .bind(...values, onlyIf.id, onlyIf.writeId);
  }
  return db
    .prepare(
      `INSERT INTO audit_log (id, actor_user_id, action, entity, entity_id, data, created_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7
       WHERE EXISTS (SELECT 1 FROM products WHERE id = ?8 AND status = ?9 AND updated_at = ?10)
         AND (?11 IS NULL OR EXISTS (SELECT 1 FROM product_verifications WHERE product_id = ?8 AND kind = ?11 AND revoked_at = ?7))`,
    )
    .bind(...values, onlyIf.productId, onlyIf.status, onlyIf.updatedAt, onlyIf.revoked ?? null);
}

/**
 * One write statement that ends in RETURNING, and its audit row guarded on that write, in one db.batch (so both or neither).
 * Returns the row, or null when the statement changed nothing; then no audit row exists either.
 */
export async function runAudited<T>(db: D1Database, write: D1PreparedStatement, audit: AuditInput, guard: AuditPartnerGuard): Promise<T | null> {
  const [res] = await db.batch<T>([write, auditStatement(db, audit, guard)]);
  return res?.results[0] ?? null;
}

export async function writeAudit(db: D1Database, input: AuditInput): Promise<void> {
  await auditStatement(db, input).run();
}

/**
 * Spec §7: one `request_invite.expire` row per invitation a system-driven sweep expired (cron lapse, builder or user
 * suspension, the cron re-sweep). Each is guarded on that invitation being expired at `now`, so a sweep that changed nothing
 * writes nothing and a second run never repeats a row. `actorUserId` is the admin for a suspension, null for the cron.
 */
export function inviteExpiryAuditStatements(
  db: D1Database,
  expired: readonly { id: string; requestId: string }[],
  input: { actorUserId: string | null; reason: "lapsed" | "builder_inactive"; now: string },
): D1PreparedStatement[] {
  return expired.map((x) =>
    auditStatement(
      db,
      { actorUserId: input.actorUserId, action: "request_invite.expire", entity: "request_invite", entityId: x.id, data: { requestId: x.requestId, reason: input.reason }, now: input.now },
      { inviteId: x.id, status: "expired", updatedAt: input.now },
    ),
  );
}

/** One audit row in the safe projection (spec §4): never `data`. The actor's e-mail and Ops membership come along so the caller can decide what to show. */
export interface AuditListing {
  id: string;
  createdAt: string;
  actorUserId: string | null;
  /** The actor's current e-mail, or null when there is no actor or the user no longer exists. */
  actorEmail: string | null;
  /** Whether the actor is an Ops member now (ops_members). The root Owner comes from ADMIN_EMAILS, outside the database. */
  actorIsOpsMember: boolean;
  action: string;
  entity: string;
  entityId: string | null;
}

const LISTING_SELECT = `SELECT a.id, a.created_at, a.actor_user_id, a.action, a.entity, a.entity_id, u.email AS actor_email, m.user_id IS NOT NULL AS actor_is_member
  FROM audit_log a LEFT JOIN users u ON u.id = a.actor_user_id LEFT JOIN ops_members m ON m.user_id = a.actor_user_id`;

type ListingRow = { id: string; created_at: string; actor_user_id: string | null; action: string; entity: string; entity_id: string | null; actor_email: string | null; actor_is_member: number };

function toListing(r: ListingRow): AuditListing {
  return {
    id: r.id,
    createdAt: r.created_at,
    actorUserId: r.actor_user_id,
    actorEmail: r.actor_email,
    actorIsOpsMember: r.actor_is_member === 1,
    action: r.action,
    entity: r.entity,
    entityId: r.entity_id,
  };
}

/** The newest audit rows, newest first (Ops Overview, VNX-2503). Selects no `data`. Read only. */
export async function listRecentAudit(db: D1Database, limit: number): Promise<AuditListing[]> {
  const { results } = await db.prepare(`${LISTING_SELECT} ORDER BY a.created_at DESC, a.id DESC LIMIT ?1`).bind(limit).all<ListingRow>();
  return results.map(toListing);
}

/** One object's audit rows, newest first (Ops detail "History", VNX-2504a). Same projection: no `data`. Read only. */
export async function listEntityAudit(db: D1Database, entity: string, entityId: string, limit: number): Promise<AuditListing[]> {
  const { results } = await db
    .prepare(`${LISTING_SELECT} WHERE a.entity = ?1 AND a.entity_id = ?2 ORDER BY a.created_at DESC, a.id DESC LIMIT ?3`)
    .bind(entity, entityId, limit)
    .all<ListingRow>();
  return results.map(toListing);
}
