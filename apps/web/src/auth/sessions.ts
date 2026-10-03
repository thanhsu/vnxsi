import { randomToken, sha256Hex } from "./crypto.ts";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  email: string;
  locale: string;
  isAdmin: boolean;
}

export async function createSession(db: D1Database, userId: string, now: Date): Promise<string> {
  const raw = randomToken();
  await db
    .prepare("INSERT INTO sessions (id_hash, user_id, expires_at, created_at) VALUES (?1, ?2, ?3, ?4)")
    .bind(await sha256Hex(raw), userId, new Date(now.getTime() + SESSION_TTL_MS).toISOString(), now.toISOString())
    .run();
  return raw;
}

export async function getSessionUser(db: D1Database, raw: string, now: Date): Promise<SessionUser | null> {
  const row = await db
    .prepare(
      `SELECT u.id, u.email, u.locale, u.is_admin FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id_hash = ?1 AND s.expires_at > ?2 AND u.status = 'active'`,
    )
    .bind(await sha256Hex(raw), now.toISOString())
    .first<{ id: string; email: string; locale: string; is_admin: number }>();
  return row ? { id: row.id, email: row.email, locale: row.locale, isAdmin: row.is_admin === 1 } : null;
}

export async function deleteSession(db: D1Database, raw: string): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE id_hash = ?1").bind(await sha256Hex(raw)).run();
}
