import { ulid } from "../lib/ulid.ts";

export async function writeAudit(
  db: D1Database,
  input: { actorUserId: string | null; action: string; entity: string; entityId: string | null; data?: Record<string, unknown>; now: string },
): Promise<void> {
  await db
    .prepare("INSERT INTO audit_log (id, actor_user_id, action, entity, entity_id, data, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)")
    .bind(ulid(Date.parse(input.now)), input.actorUserId, input.action, input.entity, input.entityId, JSON.stringify(input.data ?? {}), input.now)
    .run();
}
