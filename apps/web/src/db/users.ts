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

export async function setUserStatus(db: D1Database, input: { id: string; from: UserStatus; to: UserStatus; now: string }): Promise<boolean> {
  const res = await db.prepare("UPDATE users SET status = ?3, updated_at = ?4 WHERE id = ?1 AND status = ?2").bind(input.id, input.from, input.to, input.now).run();
  return res.meta.changes === 1;
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
