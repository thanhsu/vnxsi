import type { Badge, BadgeKind } from "../domain/product.ts";
import { ulid } from "../lib/ulid.ts";

type Row = { id: string; product_id: string; kind: BadgeKind; verified_by: string | null; evidence: string; verified_at: string; revoked_at: string | null; revoke_reason: string | null };

function toBadge(r: Row): Badge {
  return { id: r.id, productId: r.product_id, kind: r.kind, verifiedBy: r.verified_by, evidence: r.evidence, verifiedAt: r.verified_at, revokedAt: r.revoked_at, revokeReason: r.revoke_reason };
}

export async function listActiveBadges(db: D1Database, productId: string): Promise<Badge[]> {
  const { results } = await db
    .prepare("SELECT * FROM product_verifications WHERE product_id = ?1 AND revoked_at IS NULL ORDER BY verified_at, id")
    .bind(productId)
    .all<Row>();
  return results.map(toBadge);
}

/** Adds an active badge; false when one of that kind is already active (unique partial index). */
export async function grantBadge(
  db: D1Database,
  input: { productId: string; kind: BadgeKind; verifiedBy: string | null; evidence: string; now: string },
): Promise<boolean> {
  const res = await db
    .prepare(
      `INSERT INTO product_verifications (id, product_id, kind, verified_by, evidence, verified_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6
       WHERE NOT EXISTS (SELECT 1 FROM product_verifications WHERE product_id = ?2 AND kind = ?3 AND revoked_at IS NULL)`,
    )
    .bind(ulid(Date.parse(input.now)), input.productId, input.kind, input.verifiedBy, input.evidence, input.now)
    .run();
  return res.meta.changes === 1;
}

/** Revokes the active badge of that kind; false when none is active. */
export async function revokeBadge(db: D1Database, input: { productId: string; kind: BadgeKind; reason: string; now: string }): Promise<boolean> {
  const res = await db
    .prepare("UPDATE product_verifications SET revoked_at = ?4, revoke_reason = ?3 WHERE product_id = ?1 AND kind = ?2 AND revoked_at IS NULL")
    .bind(input.productId, input.kind, input.reason, input.now)
    .run();
  return res.meta.changes === 1;
}
