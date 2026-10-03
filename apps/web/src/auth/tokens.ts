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

export async function consumeLoginToken(db: D1Database, raw: string, now: Date, expectedPurpose: TokenPurpose): Promise<ConsumeResult> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(raw)) return { ok: false, reason: "invalid" };
  const hash = await sha256Hex(raw);
  const iso = now.toISOString();
  // Single atomic statement: concurrent clicks cannot both succeed.
  const row = await db
    .prepare(
      `UPDATE login_tokens SET used_at = ?2
       WHERE token_hash = ?1 AND used_at IS NULL AND expires_at > ?2 AND purpose = ?3
       RETURNING email, purpose, locale, inquiry_id, request_id, invite_code_hash`,
    )
    .bind(hash, iso, expectedPurpose)
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
  const existing = await db.prepare("SELECT used_at FROM login_tokens WHERE token_hash = ?1 AND purpose = ?2").bind(hash, expectedPurpose).first<{ used_at: string | null }>();
  if (!existing) return { ok: false, reason: "invalid" };
  return { ok: false, reason: existing.used_at ? "used" : "expired" };
}
