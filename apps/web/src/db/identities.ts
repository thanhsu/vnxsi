import { type BadgeProvider, githubProfileUrl, IDENTITY_AUDIT, type LinkRefusal, type OAuthProvider, type PublicBadge, type UserIdentity } from "../domain/identity.ts";
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

export type BadgeResult = "changed" | "unchanged" | "not_linked";

/**
 * The builder's opt-in for the public badge (ADR-012 §5): turns `show_on_profile` on or off for that user's own account of that provider and audits
 * it ({ provider } only) in the same batch. The write is filtered by `user_id`, so another user's row is never reached. Nothing is written
 * (and nothing audited) when the value already is what was asked. The flag has no public effect by itself: the badge query also needs an approved builder (Task 11).
 */
export async function setShowOnProfile(db: D1Database, input: { userId: string; provider: BadgeProvider; show: boolean; now: string }): Promise<BadgeResult> {
  const existing = await db.prepare("SELECT * FROM user_identities WHERE user_id = ?1 AND provider = ?2").bind(input.userId, input.provider).first<Row>();
  if (!existing) return "not_linked";
  const next = input.show ? 1 : 0;
  if (existing.show_on_profile === next) return "unchanged";
  const [update] = await db.batch<{ id: string }>([
    db.prepare("UPDATE user_identities SET show_on_profile = ?3, updated_at = ?4 WHERE id = ?1 AND user_id = ?2 AND show_on_profile != ?3 RETURNING id").bind(existing.id, input.userId, next, input.now),
    auditStatement(
      db,
      { actorUserId: input.userId, action: input.show ? IDENTITY_AUDIT.show : IDENTITY_AUDIT.hide, entity: "user", entityId: input.userId, data: { provider: input.provider }, now: input.now },
      { identityId: existing.id, userId: input.userId },
    ),
  ]);
  return update?.results.length ? "changed" : "unchanged";
}

/**
 * What `/b/:handle` may show (ADR-012 §5): the builder's GitHub and LinkedIn accounts that the builder opted into, only while the builder is
 * approved on an active account. Google never. The conditions live here, not in the route, so the query stands on its own: a builder who leaves
 * `approved` keeps the rows and the flag, and the badge simply stops being returned. `providers` are the ones whose flag is on and that are configured (Owner E1): another provider's row is not returned. LinkedIn's label (often an e-mail) is never selected;
 * a GitHub label that is not a plain login yields no badge (no half-drawn link). Not read by ranking, catalogue or directory code (ADR-004).
 */
export async function listPublicBadges(db: D1Database, builderUserId: string, providers: readonly BadgeProvider[]): Promise<PublicBadge[]> {
  if (providers.length === 0) return [];
  const marks = providers.map((_, i) => `?${i + 2}`).join(", "); // placeholders only: the values are bound, never interpolated
  const { results } = await db
    .prepare(
      `SELECT i.provider AS provider, CASE WHEN i.provider = 'github' THEN i.label END AS login
       FROM user_identities i
       JOIN builders b ON b.user_id = i.user_id
       JOIN users u ON u.id = i.user_id
       WHERE i.user_id = ?1 AND i.show_on_profile = 1 AND i.provider IN (${marks})
         AND b.status = 'approved' AND u.status = 'active'
       ORDER BY i.provider`,
    )
    .bind(builderUserId, ...providers)
    .all<{ provider: "github" | "linkedin"; login: string | null }>();
  const badges: PublicBadge[] = [];
  for (const r of results) {
    if (r.provider === "linkedin") badges.push({ provider: "linkedin" });
    else {
      const url = r.login === null ? null : githubProfileUrl(r.login);
      if (r.login !== null && url !== null) badges.push({ provider: "github", login: r.login, url });
    }
  }
  return badges;
}
