import type { Invite } from "../domain/invite.ts";

type Row = { code_hash: string; created_by: string; max_uses: number; uses: number; expires_at: string; note: string | null; created_at: string };

function toInvite(r: Row): Invite {
  return { codeHash: r.code_hash, createdBy: r.created_by, maxUses: r.max_uses, uses: r.uses, expiresAt: r.expires_at, note: r.note, createdAt: r.created_at };
}

export async function createInvite(
  db: D1Database,
  input: { codeHash: string; createdBy: string; maxUses: number; expiresAt: string; note: string | null; now: string },
): Promise<void> {
  await db
    .prepare("INSERT INTO invites (code_hash, created_by, max_uses, uses, expires_at, note, created_at, updated_at) VALUES (?1, ?2, ?3, 0, ?4, ?5, ?6, ?6)")
    .bind(input.codeHash, input.createdBy, input.maxUses, input.expiresAt, input.note, input.now)
    .run();
}

export async function findInvite(db: D1Database, codeHash: string): Promise<Invite | null> {
  const row = await db.prepare("SELECT * FROM invites WHERE code_hash = ?1").bind(codeHash).first<Row>();
  return row ? toInvite(row) : null;
}

export async function listInvites(db: D1Database, limit = 100): Promise<Invite[]> {
  const { results } = await db.prepare("SELECT * FROM invites ORDER BY created_at DESC LIMIT ?1").bind(limit).all<Row>();
  return results.map(toInvite);
}

/**
 * Spends one use, but only if the builder row written earlier in the same batch recorded this invite.
 * Used by createBuilder inside db.batch, so both statements commit or roll back together.
 */
export function consumeInviteStatement(db: D1Database, codeHash: string, userId: string, now: string): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE invites SET uses = uses + 1, updated_at = ?3
       WHERE code_hash = ?1 AND uses < max_uses AND expires_at > ?3
         AND EXISTS (SELECT 1 FROM builders WHERE user_id = ?2 AND invite_code_hash = ?1)`,
    )
    .bind(codeHash, userId, now);
}
