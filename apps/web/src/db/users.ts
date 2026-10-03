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
  await db
    .prepare(
      `UPDATE users SET last_login_at = ?2, updated_at = ?2,
         is_admin = CASE WHEN ?3 = 1 THEN 1 ELSE is_admin END
       WHERE id = ?1`,
    )
    .bind(id, input.now, input.isAdmin ? 1 : 0)
    .run();
}
