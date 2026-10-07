import { isSessionMethod, type SessionMethod } from "../domain/identity.ts";
import { randomToken, sha256Hex } from "./crypto.ts";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  email: string;
  locale: string;
  isAdmin: boolean;
  /** How the session was created (ADR-012 §2). /ops and /admin accept only "magic_link". */
  method: SessionMethod;
}

export async function createSession(db: D1Database, userId: string, now: Date, method: SessionMethod = "magic_link"): Promise<string> {
  const raw = randomToken();
  await db
    .prepare("INSERT INTO sessions (id_hash, user_id, expires_at, created_at, method) VALUES (?1, ?2, ?3, ?4, ?5)")
    .bind(await sha256Hex(raw), userId, new Date(now.getTime() + SESSION_TTL_MS).toISOString(), now.toISOString(), method)
    .run();
  return raw;
}

export async function getSessionUser(db: D1Database, raw: string, now: Date): Promise<SessionUser | null> {
  const row = await db
    .prepare(
      `SELECT u.id, u.email, u.locale, u.is_admin, s.method FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id_hash = ?1 AND s.expires_at > ?2 AND u.status = 'active'`,
    )
    .bind(await sha256Hex(raw), now.toISOString())
    .first<{ id: string; email: string; locale: string; is_admin: number; method: string }>();
  // Fail closed: a method this code does not know (the CHECK makes that impossible) is no session, never a default one.
  if (!row || !isSessionMethod(row.method)) return null;
  return { id: row.id, email: row.email, locale: row.locale, isAdmin: row.is_admin === 1, method: row.method };
}

export async function deleteSession(db: D1Database, raw: string): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE id_hash = ?1").bind(await sha256Hex(raw)).run();
}

/** Deletes sessions that expired before `now`. Returns the rows deleted. */
export async function deleteExpiredSessions(db: D1Database, now: Date): Promise<number> {
  const result = await db.prepare("DELETE FROM sessions WHERE expires_at < ?1").bind(now.toISOString()).run();
  return result.meta.changes;
}

/** Only deletes while the user is suspended, so a batch whose status change lost the race leaves sessions alone. */
export function deleteUserSessionsStatement(db: D1Database, userId: string): D1PreparedStatement {
  return db.prepare("DELETE FROM sessions WHERE user_id = ?1 AND EXISTS (SELECT 1 FROM users WHERE id = ?1 AND status = 'suspended')").bind(userId);
}
