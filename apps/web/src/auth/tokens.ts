import { isLocale, type Locale } from "../i18n/locales.ts";
import { randomToken, sha256Hex } from "./crypto.ts";

export const LOGIN_TOKEN_TTL_MS = 15 * 60 * 1000;
export type TokenPurpose = "login" | "inquiry_verify" | "request_verify";

export interface ConsumedToken {
  email: string;
  purpose: TokenPurpose;
  locale: Locale;
  inquiryId: string | null;
  requestId: string | null;
  inviteCodeHash: string | null;
}

export type ConsumeResult = { ok: true; token: ConsumedToken } | { ok: false; reason: "invalid" | "expired" | "used" };

export async function createLoginToken(
  db: D1Database,
  input: { email: string; purpose: TokenPurpose; locale: Locale; inviteCodeHash?: string | null; inquiryId?: string | null; requestId?: string | null },
  now: Date,
): Promise<string> {
  const raw = randomToken();
  await db
    .prepare(
      `INSERT INTO login_tokens (token_hash, email, purpose, locale, inquiry_id, request_id, invite_code_hash, expires_at, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    )
    .bind(
      await sha256Hex(raw),
      input.email,
      input.purpose,
      input.locale,
      input.inquiryId ?? null,
      input.requestId ?? null,
      input.inviteCodeHash ?? null,
      new Date(now.getTime() + LOGIN_TOKEN_TTL_MS).toISOString(),
      now.toISOString(),
    )
    .run();
  return raw;
}

type Row = { email: string; purpose: TokenPurpose; locale: string; inquiry_id: string | null; request_id: string | null; invite_code_hash: string | null };

const purposeList = (expected: TokenPurpose | readonly TokenPurpose[]) => JSON.stringify(typeof expected === "string" ? [expected] : expected);

/**
 * Spends the token if it is unused, unexpired and of one of the expected purposes. A token of another purpose is
 * neither used nor spent.
 */
export async function consumeLoginToken(db: D1Database, raw: string, now: Date, expected: TokenPurpose | readonly TokenPurpose[]): Promise<ConsumeResult> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(raw)) return { ok: false, reason: "invalid" };
  const hash = await sha256Hex(raw);
  const iso = now.toISOString();
  const purposes = purposeList(expected);
  // Single atomic statement: concurrent clicks cannot both succeed.
  const row = await db
    .prepare(
      `UPDATE login_tokens SET used_at = ?2
       WHERE token_hash = ?1 AND used_at IS NULL AND expires_at > ?2 AND purpose IN (SELECT value FROM json_each(?3))
       RETURNING email, purpose, locale, inquiry_id, request_id, invite_code_hash`,
    )
    .bind(hash, iso, purposes)
    .first<Row>();
  if (row) {
    return {
      ok: true,
      token: {
        email: row.email,
        purpose: row.purpose,
        locale: isLocale(row.locale) ? row.locale : "en",
        inquiryId: row.inquiry_id,
        requestId: row.request_id,
        inviteCodeHash: row.invite_code_hash,
      },
    };
  }
  return { ok: false, reason: await failureReason(db, hash, purposes) };
}

async function failureReason(db: D1Database, hash: string, purposes: string): Promise<"invalid" | "used" | "expired"> {
  const existing = await db
    .prepare("SELECT used_at FROM login_tokens WHERE token_hash = ?1 AND purpose IN (SELECT value FROM json_each(?2))")
    .bind(hash, purposes)
    .first<{ used_at: string | null }>();
  if (!existing) return "invalid";
  return existing.used_at ? "used" : "expired";
}

/** Reads a token without spending it (the GET confirmation page, VNX-0506). */
export async function peekLoginToken(
  db: D1Database,
  raw: string,
  now: Date,
  purposes: readonly TokenPurpose[],
): Promise<{ ok: true; purpose: TokenPurpose; locale: Locale } | { ok: false; reason: "invalid" | "expired" | "used" }> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(raw)) return { ok: false, reason: "invalid" };
  const hash = await sha256Hex(raw);
  const list = JSON.stringify(purposes);
  const row = await db
    .prepare("SELECT purpose, locale FROM login_tokens WHERE token_hash = ?1 AND used_at IS NULL AND expires_at > ?2 AND purpose IN (SELECT value FROM json_each(?3))")
    .bind(hash, now.toISOString(), list)
    .first<{ purpose: TokenPurpose; locale: string }>();
  if (row) return { ok: true, purpose: row.purpose, locale: isLocale(row.locale) ? row.locale : "en" };
  return { ok: false, reason: await failureReason(db, hash, list) };
}

/** Spec §8.4: tokens past their expiry are useless. Returns rows deleted. */
export async function deleteExpiredTokens(db: D1Database, now: Date): Promise<number> {
  const res = await db.prepare("DELETE FROM login_tokens WHERE expires_at < ?1").bind(now.toISOString()).run();
  return res.meta.changes;
}
