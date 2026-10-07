import { IDENTITY_AUDIT, type LinkRefusal, type OAuthProvider, type UserIdentity } from "../domain/identity.ts";
import { ulid } from "../lib/ulid.ts";
import { auditStatement } from "./audit.ts";

/**
 * The only writer of `user_identities` (module `identity`, EPIC 26, VNX-2602). Linked accounts of one user: provider, the provider's
 * immutable subject, a label for the owner to recognise it, the opt-in badge flag. No token is ever stored (ADR-012 §1).
 * Link and unlink write their audit row in the same db.batch (the row carries the provider only).
 */

type Row = {
  id: string;
  user_id: string;
  provider: OAuthProvider;
  provider_subject: string;
  label: string;
  show_on_profile: number;
  linked_at: string;
  last_used_at: string | null;
  updated_at: string;
};

const toIdentity = (r: Row): UserIdentity => ({
  id: r.id,
  userId: r.user_id,
  provider: r.provider,
  subject: r.provider_subject,
  label: r.label,
  showOnProfile: r.show_on_profile === 1,
  linkedAt: r.linked_at,
  lastUsedAt: r.last_used_at,
  updatedAt: r.updated_at,
});

export type LinkResult = { ok: true; identity: UserIdentity } | { ok: false; reason: LinkRefusal };

async function findIdentityById(db: D1Database, id: string): Promise<UserIdentity | null> {
  const row = await db.prepare("SELECT * FROM user_identities WHERE id = ?1").bind(id).first<Row>();
  return row ? toIdentity(row) : null;
}

/** The sign-in lookup: who, if anyone, has linked this provider account. */
export async function findIdentityByProviderSubject(db: D1Database, provider: OAuthProvider, subject: string): Promise<UserIdentity | null> {
  const row = await db.prepare("SELECT * FROM user_identities WHERE provider = ?1 AND provider_subject = ?2").bind(provider, subject).first<Row>();
  return row ? toIdentity(row) : null;
}

/** One user's linked accounts, ordered by provider. For that user's own account page only. */
export async function listIdentitiesForUser(db: D1Database, userId: string): Promise<UserIdentity[]> {
  const { results } = await db.prepare("SELECT * FROM user_identities WHERE user_id = ?1 ORDER BY provider").bind(userId).all<Row>();
  return results.map(toIdentity);
}

/**
 * Links a provider account to a user and audits it, atomically. `ON CONFLICT DO NOTHING` covers both UNIQUE constraints; when nothing
 * was inserted, one read says why: the same user already holds this account (`already_linked`, nothing changes), another user holds it
 * (`provider_account_taken`, who is never returned), or this user holds a different account of that provider (`user_has_provider`).
 */
export async function linkIdentity(
  db: D1Database,
  input: { userId: string; provider: OAuthProvider; subject: string; label: string; now: string },
): Promise<LinkResult> {
  const id = ulid(Date.parse(input.now));
  const [insert] = await db.batch<{ id: string }>([
    db
      .prepare(
        `INSERT INTO user_identities (id, user_id, provider, provider_subject, label, show_on_profile, linked_at, last_used_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6, NULL, ?6)
         ON CONFLICT DO NOTHING
         RETURNING id`,
      )
      .bind(id, input.userId, input.provider, input.subject, input.label, input.now),
    auditStatement(
      db,
      { actorUserId: input.userId, action: IDENTITY_AUDIT.link, entity: "user", entityId: input.userId, data: { provider: input.provider }, now: input.now },
      { identityId: id, userId: input.userId },
    ),
  ]);
  if (insert?.results.length) {
    const identity = await findIdentityById(db, id);
    if (!identity) throw new Error("identity insert failed");
    return { ok: true, identity };
  }
  const holder = await findIdentityByProviderSubject(db, input.provider, input.subject);
  if (holder) return { ok: false, reason: holder.userId === input.userId ? "already_linked" : "provider_account_taken" };
  return { ok: false, reason: "user_has_provider" };
}

/**
 * Removes the user's account of that provider and audits it, atomically. The audit statement runs first: it is guarded on the row
 * existing for that user, which is no longer true after the DELETE. Null (and no audit row) when the user has none.
 */
export async function unlinkIdentity(db: D1Database, input: { userId: string; provider: OAuthProvider; now: string }): Promise<UserIdentity | null> {
  const existing = await db.prepare("SELECT * FROM user_identities WHERE user_id = ?1 AND provider = ?2").bind(input.userId, input.provider).first<Row>();
  if (!existing) return null;
  const [, removed] = await db.batch<{ id: string }>([
    auditStatement(
      db,
      { actorUserId: input.userId, action: IDENTITY_AUDIT.unlink, entity: "user", entityId: input.userId, data: { provider: input.provider }, now: input.now },
      { identityId: existing.id, userId: input.userId },
    ),
    db.prepare("DELETE FROM user_identities WHERE id = ?1 AND user_id = ?2 RETURNING id").bind(existing.id, input.userId),
  ]);
  return removed?.results.length ? toIdentity(existing) : null;
}

/** A sign-in with this identity: records the time and refreshes the label (the GitHub login can change; ADR-012 §5). */
export async function touchIdentityLogin(db: D1Database, input: { id: string; label: string; now: string }): Promise<void> {
  await db.prepare("UPDATE user_identities SET label = ?2, last_used_at = ?3, updated_at = ?3 WHERE id = ?1").bind(input.id, input.label, input.now).run();
}
