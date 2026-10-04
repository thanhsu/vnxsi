import type { BuilderStatus } from "../domain/builder.ts";
import type { UserStatus, UserSummary } from "../domain/user.ts";
import { ulid } from "../lib/ulid.ts";

export interface UserRow {
  id: string;
  email: string;
  display_name: string | null;
  locale: string;
  is_admin: number;
  status: "active" | "suspended";
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function findUserByEmail(db: D1Database, email: string): Promise<UserRow | null> {
  return db.prepare("SELECT * FROM users WHERE email = ?1").bind(normalizeEmail(email)).first<UserRow>();
}

export function findUserById(db: D1Database, id: string): Promise<UserRow | null> {
  return db.prepare("SELECT * FROM users WHERE id = ?1").bind(id).first<UserRow>();
}

export async function createUser(db: D1Database, input: { email: string; locale: string; now: string }): Promise<UserRow> {
  const id = ulid(Date.parse(input.now));
  await db
    .prepare("INSERT INTO users (id, email, locale, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)")
    .bind(id, normalizeEmail(input.email), input.locale, input.now)
    .run();
  const row = await findUserById(db, id);
  if (!row) throw new Error("user insert failed");
  return row;
}

export async function markLogin(db: D1Database, id: string, input: { now: string; isAdmin: boolean }): Promise<void> {
  // ADMIN_EMAILS is the source of truth (Owner decision 2026-10-03): grant and revoke.
  await db
    .prepare("UPDATE users SET last_login_at = ?2, updated_at = ?2, is_admin = ?3 WHERE id = ?1")
    .bind(id, input.now, input.isAdmin ? 1 : 0)
    .run();
}

export function setUserStatusStatement(db: D1Database, input: { id: string; from: UserStatus; to: UserStatus; now: string }): D1PreparedStatement {
  return db.prepare("UPDATE users SET status = ?3, updated_at = ?4 WHERE id = ?1 AND status = ?2").bind(input.id, input.from, input.to, input.now);
}

/** Substring match on e-mail; % and _ in the query are literal. Newest accounts first. */
export async function searchUsers(db: D1Database, query: string, limit = 50): Promise<UserSummary[]> {
  const pattern = `%${normalizeEmail(query).replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
  const { results } = await db
    .prepare(
      `SELECT u.id, u.email, u.status, u.is_admin, b.handle AS builder_handle, b.status AS builder_status
       FROM users u LEFT JOIN builders b ON b.user_id = u.id
       WHERE u.email LIKE ?1 ESCAPE '\\'
       ORDER BY u.created_at DESC LIMIT ?2`,
    )
    .bind(pattern, limit)
    .all<{ id: string; email: string; status: UserStatus; is_admin: number; builder_handle: string | null; builder_status: BuilderStatus | null }>();
  return results.map((r) => ({ id: r.id, email: r.email, status: r.status, isAdmin: r.is_admin === 1, builderHandle: r.builder_handle, builderStatus: r.builder_status }));
}

/** Sets the display name only when the account has none (first confirmed inquiry; Owner decision 2026-10-04). */
export async function setDisplayNameIfEmpty(db: D1Database, id: string, name: string, now: string): Promise<void> {
  await db
    .prepare("UPDATE users SET display_name = ?2, updated_at = ?3 WHERE id = ?1 AND (display_name IS NULL OR display_name = '')")
    .bind(id, name, now)
    .run();
}

/**
 * Owner decision 2026-10-04: implicit accounts created before `cutoff` that never signed in and have nothing attached are
 * removed (nothing attached: no session, builder, inquiry, message, invite, verification, request or audit row).
 */
export async function deleteGhostUsers(db: D1Database, cutoff: string): Promise<number> {
  const res = await db
    .prepare(
      `DELETE FROM users
       WHERE created_at < ?1 AND last_login_at IS NULL AND is_admin = 0 AND status = 'active'
         AND NOT EXISTS (SELECT 1 FROM sessions s WHERE s.user_id = users.id)
         AND NOT EXISTS (SELECT 1 FROM builders b WHERE b.user_id = users.id)
         AND NOT EXISTS (SELECT 1 FROM inquiries i WHERE i.client_user_id = users.id)
         AND NOT EXISTS (SELECT 1 FROM inquiry_messages m WHERE m.sender_user_id = users.id)
         AND NOT EXISTS (SELECT 1 FROM requests r WHERE r.client_user_id = users.id)
         AND NOT EXISTS (SELECT 1 FROM request_invites x WHERE x.invited_by = users.id)
         AND NOT EXISTS (SELECT 1 FROM invites v WHERE v.created_by = users.id)
         AND NOT EXISTS (SELECT 1 FROM product_verifications pv WHERE pv.verified_by = users.id)
         AND NOT EXISTS (SELECT 1 FROM audit_log a WHERE a.actor_user_id = users.id)`,
    )
    .bind(cutoff)
    .run();
  return res.meta.changes;
}
