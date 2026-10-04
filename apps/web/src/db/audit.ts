import type { BadgeKind } from "../domain/product.ts";
import { ulid } from "../lib/ulid.ts";
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

/**
 * The audit INSERT as a statement, so a route can commit it in one db.batch with the change it records.
 * With a guard the row is written only when the same batch's compare-and-set went through (a lost compare-and-set
 * writes no audit row): `userId` guards on the user's status, `productId` on the product's, `inquiryId` on the inquiry's, `requestId` on the request's, `inviteId` on the invitation's.
 */
export function auditStatement(db: D1Database, input: AuditInput, onlyIf?: AuditUserGuard | AuditProductGuard | AuditInquiryGuard | AuditRequestGuard | AuditInvitesGuard | AuditInviteGuard): D1PreparedStatement {
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
  return db
    .prepare(
      `INSERT INTO audit_log (id, actor_user_id, action, entity, entity_id, data, created_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7
       WHERE EXISTS (SELECT 1 FROM products WHERE id = ?8 AND status = ?9 AND updated_at = ?10)
         AND (?11 IS NULL OR EXISTS (SELECT 1 FROM product_verifications WHERE product_id = ?8 AND kind = ?11 AND revoked_at = ?7))`,
    )
    .bind(...values, onlyIf.productId, onlyIf.status, onlyIf.updatedAt, onlyIf.revoked ?? null);
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
