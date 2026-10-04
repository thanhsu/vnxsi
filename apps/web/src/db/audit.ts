import { ulid } from "../lib/ulid.ts";

export type AuditInput = { actorUserId: string | null; action: string; entity: string; entityId: string | null; data?: Record<string, unknown>; now: string };

/**
 * The audit INSERT as a statement, so a route can commit it in one db.batch with the change it records.
 * With `onlyIfUser` the row is written only when that user currently has this status and was last updated at that
 * instant, i.e. when the same batch's status change went through (a lost compare-and-set writes no audit row).
 */
export function auditStatement(db: D1Database, input: AuditInput, onlyIfUser?: { userId: string; status: string; updatedAt: string }): D1PreparedStatement {
  const id = ulid(Date.parse(input.now));
  const data = JSON.stringify(input.data ?? {});
  if (!onlyIfUser) {
    return db
      .prepare("INSERT INTO audit_log (id, actor_user_id, action, entity, entity_id, data, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)")
      .bind(id, input.actorUserId, input.action, input.entity, input.entityId, data, input.now);
  }
  return db
    .prepare(
      `INSERT INTO audit_log (id, actor_user_id, action, entity, entity_id, data, created_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7
       WHERE EXISTS (SELECT 1 FROM users WHERE id = ?8 AND status = ?9 AND updated_at = ?10)`,
    )
    .bind(id, input.actorUserId, input.action, input.entity, input.entityId, data, input.now, onlyIfUser.userId, onlyIfUser.status, onlyIfUser.updatedAt);
}

export async function writeAudit(db: D1Database, input: AuditInput): Promise<void> {
  await auditStatement(db, input).run();
}
