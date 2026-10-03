import type { Builder, BuilderProfile, BuilderStatus } from "../domain/builder.ts";
import { consumeInviteStatement } from "./invites.ts";

export type BuilderRow = {
  user_id: string;
  handle: string;
  name: string;
  kind: Builder["kind"];
  headline: string;
  bio: string;
  country: string;
  website_url: string | null;
  skills: string;
  ai_tools: string;
  work_languages: string;
  availability: Builder["availability"];
  hourly_rate_cents: number | null;
  status: BuilderStatus;
  review_note: string | null;
  invite_code_hash: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

function jsonList(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function toBuilder(r: BuilderRow): Builder {
  return {
    userId: r.user_id,
    handle: r.handle,
    name: r.name,
    kind: r.kind,
    headline: r.headline,
    bio: r.bio,
    country: r.country,
    websiteUrl: r.website_url,
    skills: jsonList(r.skills),
    aiTools: jsonList(r.ai_tools),
    workLanguages: jsonList(r.work_languages) as Builder["workLanguages"],
    availability: r.availability,
    hourlyRateCents: r.hourly_rate_cents,
    status: r.status,
    reviewNote: r.review_note,
    inviteCodeHash: r.invite_code_hash,
    approvedAt: r.approved_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function findBuilderByUserId(db: D1Database, userId: string): Promise<Builder | null> {
  const row = await db.prepare("SELECT * FROM builders WHERE user_id = ?1").bind(userId).first<BuilderRow>();
  return row ? toBuilder(row) : null;
}

export async function findBuilderByHandle(db: D1Database, handle: string): Promise<Builder | null> {
  const row = await db.prepare("SELECT * FROM builders WHERE handle = ?1").bind(handle).first<BuilderRow>();
  return row ? toBuilder(row) : null;
}

export type CreateBuilderResult = { ok: true; builder: Builder } | { ok: false; reason: "handle_taken" | "already_builder" };

/**
 * Inserts the builder and, in the same D1 transaction, spends one use of the invite.
 * A usable invite makes the builder approved; otherwise it starts pending (spec §5.3).
 */
export async function createBuilder(
  db: D1Database,
  input: { userId: string; profile: BuilderProfile; inviteCodeHash: string | null; now: string },
): Promise<CreateBuilderResult> {
  const p = input.profile;
  const insert = db
    .prepare(
      `INSERT INTO builders (user_id, handle, name, kind, headline, bio, country, website_url, skills, ai_tools, work_languages,
         availability, hourly_rate_cents, status, invite_code_hash, approved_at, created_at, updated_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13,
         CASE WHEN v.ok THEN 'approved' ELSE 'pending' END,
         CASE WHEN v.ok THEN ?14 END,
         CASE WHEN v.ok THEN ?15 END,
         ?15, ?15
       FROM (SELECT EXISTS (SELECT 1 FROM invites WHERE code_hash = ?14 AND uses < max_uses AND expires_at > ?15) AS ok) AS v`,
    )
    .bind(
      input.userId,
      p.handle,
      p.name,
      p.kind,
      p.headline,
      p.bio,
      p.country,
      p.websiteUrl,
      JSON.stringify(p.skills),
      JSON.stringify(p.aiTools),
      JSON.stringify(p.workLanguages),
      p.availability,
      p.hourlyRateCents,
      input.inviteCodeHash,
      input.now,
    );
  try {
    if (input.inviteCodeHash) await db.batch([insert, consumeInviteStatement(db, input.inviteCodeHash, input.userId, input.now)]);
    else await insert.run();
  } catch (err) {
    const message = String(err);
    if (message.includes("builders.handle")) return { ok: false, reason: "handle_taken" };
    if (message.includes("builders.user_id")) return { ok: false, reason: "already_builder" };
    throw err;
  }
  const builder = await findBuilderByUserId(db, input.userId);
  if (!builder) throw new Error("builder insert failed");
  return { ok: true, builder };
}

export type UpdateProfileResult = "ok" | "handle_taken" | "stale";

/** Writes the profile only if the status is still `expectedStatus` (guards against a concurrent admin decision). */
export async function updateBuilderProfile(
  db: D1Database,
  input: { userId: string; expectedStatus: BuilderStatus; profile: BuilderProfile; now: string },
): Promise<UpdateProfileResult> {
  const p = input.profile;
  try {
    const res = await db
      .prepare(
        `UPDATE builders SET handle = ?3, name = ?4, kind = ?5, headline = ?6, bio = ?7, country = ?8, website_url = ?9,
           skills = ?10, ai_tools = ?11, work_languages = ?12, availability = ?13, hourly_rate_cents = ?14, updated_at = ?15
         WHERE user_id = ?1 AND status = ?2`,
      )
      .bind(
        input.userId,
        input.expectedStatus,
        p.handle,
        p.name,
        p.kind,
        p.headline,
        p.bio,
        p.country,
        p.websiteUrl,
        JSON.stringify(p.skills),
        JSON.stringify(p.aiTools),
        JSON.stringify(p.workLanguages),
        p.availability,
        p.hourlyRateCents,
        input.now,
      )
      .run();
    return res.meta.changes === 1 ? "ok" : "stale";
  } catch (err) {
    if (String(err).includes("builders.handle")) return "handle_taken";
    throw err;
  }
}

/** Compare-and-set on status. Returns null when the builder is no longer in `from`. */
export async function setBuilderStatus(
  db: D1Database,
  input: { userId: string; from: BuilderStatus; to: BuilderStatus; reviewNote: string | null; now: string },
): Promise<Builder | null> {
  const row = await db
    .prepare(
      `UPDATE builders SET status = ?3, review_note = ?4, updated_at = ?5,
         approved_at = CASE WHEN ?3 = 'approved' THEN COALESCE(approved_at, ?5) ELSE approved_at END
       WHERE user_id = ?1 AND status = ?2
       RETURNING *`,
    )
    .bind(input.userId, input.from, input.to, input.reviewNote, input.now)
    .first<BuilderRow>();
  return row ? toBuilder(row) : null;
}
