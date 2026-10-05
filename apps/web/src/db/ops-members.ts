import { opsInviteExpiresAt, type GrantableRole, type OpsInvite, type OpsInviteStatus, type OpsMember, type OpsMemberListing } from "../domain/ops.ts";
import { ulid } from "../lib/ulid.ts";

/**
 * The only writer of `ops_members` and `ops_member_invites` (module `ops`, plan O1, VNX-2501). Every write is a statement,
 * so a route can commit it in one db.batch with its audit row (spec §3.4); a statement run on its own works the same.
 */

type MemberRow = { user_id: string; role: GrantableRole; granted_by: string; granted_at: string; updated_at: string };
type InviteRow = {
  id: string;
  email: string;
  role: GrantableRole;
  created_by: string;
  status: OpsInviteStatus;
  expires_at: string;
  accepted_by: string | null;
  created_at: string;
  updated_at: string;
};

const toMember = (r: MemberRow): OpsMember => ({ userId: r.user_id, role: r.role, grantedBy: r.granted_by, grantedAt: r.granted_at, updatedAt: r.updated_at });

const toInvite = (r: InviteRow): OpsInvite => ({
  id: r.id,
  email: r.email,
  role: r.role,
  createdBy: r.created_by,
  status: r.status,
  expiresAt: r.expires_at,
  acceptedBy: r.accepted_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

/** Same normalisation as users.email. */
const normalizeEmail = (email: string) => email.trim().toLowerCase();

export async function findOpsMember(db: D1Database, userId: string): Promise<OpsMember | null> {
  const row = await db.prepare("SELECT * FROM ops_members WHERE user_id = ?1").bind(userId).first<MemberRow>();
  return row ? toMember(row) : null;
}

/** Every member with their e-mail, earliest grant first. */
export async function listOpsMembers(db: D1Database): Promise<OpsMemberListing[]> {
  const rows = await db
    .prepare("SELECT m.*, u.email FROM ops_members m JOIN users u ON u.id = m.user_id ORDER BY m.granted_at, m.user_id")
    .all<MemberRow & { email: string }>();
  return rows.results.map((r) => ({ ...toMember(r), email: r.email }));
}

export async function findOpsInviteById(db: D1Database, id: string): Promise<OpsInvite | null> {
  const row = await db.prepare("SELECT * FROM ops_member_invites WHERE id = ?1").bind(id).first<InviteRow>();
  return row ? toInvite(row) : null;
}

/** The pending invitation for this e-mail, if any (there is at most one). It may be past `expires_at` until the sweep runs. */
export async function findPendingOpsInvite(db: D1Database, email: string): Promise<OpsInvite | null> {
  const row = await db.prepare("SELECT * FROM ops_member_invites WHERE email = ?1 AND status = 'pending'").bind(normalizeEmail(email)).first<InviteRow>();
  return row ? toInvite(row) : null;
}

/** Newest first. */
export async function listOpsInvites(db: D1Database, status: OpsInviteStatus): Promise<OpsInvite[]> {
  const rows = await db.prepare("SELECT * FROM ops_member_invites WHERE status = ?1 ORDER BY created_at DESC, id DESC").bind(status).all<InviteRow>();
  return rows.results.map(toInvite);
}

/**
 * A pending invitation that expires INVITE_TTL_MS after `now`. Inserts nothing (and returns no row) when this e-mail
 * already has a pending invitation; the unique index `uq_ops_invite_pending` backs this up under a race.
 */
export function createOpsInviteStatement(
  db: D1Database,
  input: { email: string; role: GrantableRole; createdBy: string; now: string },
): { id: string; statement: D1PreparedStatement } {
  const id = ulid(Date.parse(input.now));
  const statement = db
    .prepare(
      `INSERT INTO ops_member_invites (id, email, role, created_by, status, expires_at, created_at, updated_at)
       SELECT ?1, ?2, ?3, ?4, 'pending', ?5, ?6, ?6
       WHERE NOT EXISTS (SELECT 1 FROM ops_member_invites WHERE email = ?2 AND status = 'pending')
       RETURNING id`,
    )
    .bind(id, normalizeEmail(input.email), input.role, input.createdBy, opsInviteExpiresAt(input.now), input.now);
  return { id, statement };
}

/** pending → cancelled. Changes nothing (and returns no row) unless the invitation is still pending. */
export function cancelOpsInviteStatement(db: D1Database, input: { id: string; now: string }): D1PreparedStatement {
  return db.prepare("UPDATE ops_member_invites SET status = 'cancelled', updated_at = ?2 WHERE id = ?1 AND status = 'pending' RETURNING id").bind(input.id, input.now);
}

/**
 * Accepting an invitation after the magic link proved `userId` owns its e-mail (spec §3.3): two statements for one
 * db.batch with the audit row. The first creates the member, or gives an existing member the invited role; the second
 * marks the invitation accepted. Both carry the same guard (still pending, not expired, addressed to that user's
 * e-mail), so either both change one row or neither changes anything.
 */
export function acceptOpsInviteStatements(db: D1Database, input: { inviteId: string; userId: string; now: string }): D1PreparedStatement[] {
  return [
    db
      .prepare(
        `INSERT INTO ops_members (user_id, role, granted_by, granted_at, updated_at)
         SELECT u.id, i.role, i.created_by, ?3, ?3
         FROM ops_member_invites i JOIN users u ON u.id = ?2 AND u.email = i.email
         WHERE i.id = ?1 AND i.status = 'pending' AND i.expires_at > ?3
         ON CONFLICT (user_id) DO UPDATE SET role = excluded.role, granted_by = excluded.granted_by, granted_at = excluded.granted_at, updated_at = excluded.updated_at`,
      )
      .bind(input.inviteId, input.userId, input.now),
    db
      .prepare(
        `UPDATE ops_member_invites SET status = 'accepted', accepted_by = ?2, updated_at = ?3
         WHERE id = ?1 AND status = 'pending' AND expires_at > ?3 AND email = (SELECT email FROM users WHERE id = ?2)
         RETURNING id`,
      )
      .bind(input.inviteId, input.userId, input.now),
  ];
}

/** Compare-and-set of a member's role; records who changed it and when. Returns no row unless the role was still `from`. */
export function setOpsMemberRoleStatement(
  db: D1Database,
  input: { userId: string; from: GrantableRole; to: GrantableRole; by: string; now: string },
): D1PreparedStatement {
  return db
    .prepare("UPDATE ops_members SET role = ?3, granted_by = ?4, granted_at = ?5, updated_at = ?5 WHERE user_id = ?1 AND role = ?2 RETURNING user_id")
    .bind(input.userId, input.from, input.to, input.by, input.now);
}

/** Removes the member; returns the removed row (user_id, role), or none if there was no member. */
export function deleteOpsMemberStatement(db: D1Database, input: { userId: string }): D1PreparedStatement {
  return db.prepare("DELETE FROM ops_members WHERE user_id = ?1 RETURNING user_id, role").bind(input.userId);
}

/**
 * The daily sweep: every pending invitation whose `expires_at` has been reached becomes `expired` (same instant rule as
 * isExpired). Returns the swept rows (id, email, role) for their audit rows. Never touches ops_members.
 */
export function expireOpsInvitesStatement(db: D1Database, now: string): D1PreparedStatement {
  return db.prepare("UPDATE ops_member_invites SET status = 'expired', updated_at = ?1 WHERE status = 'pending' AND expires_at <= ?1 RETURNING id, email, role").bind(now);
}
