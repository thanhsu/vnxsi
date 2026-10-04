import type { Badge, BadgeKind } from "../domain/product.ts";
import { ulid } from "../lib/ulid.ts";
import type { ProductGuard } from "./products.ts";

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

/**
 * Adds an active badge unless one of that kind is already active (unique partial index), as a statement for db.batch.
 * With `onlyIf` the row is added only when the same batch's product compare-and-set went through.
 */
export function grantBadgeStatement(
  db: D1Database,
  input: { productId: string; kind: BadgeKind; verifiedBy: string | null; evidence: string; now: string },
  onlyIf?: ProductGuard,
): D1PreparedStatement {
  const guard = onlyIf ? " AND EXISTS (SELECT 1 FROM products WHERE id = ?7 AND status = ?8 AND updated_at = ?9)" : "";
  const params = [ulid(Date.parse(input.now)), input.productId, input.kind, input.verifiedBy, input.evidence, input.now];
  return db
    .prepare(
      `INSERT INTO product_verifications (id, product_id, kind, verified_by, evidence, verified_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6
       WHERE NOT EXISTS (SELECT 1 FROM product_verifications WHERE product_id = ?2 AND kind = ?3 AND revoked_at IS NULL)${guard}`,
    )
    .bind(...params, ...(onlyIf ? [onlyIf.productId, onlyIf.status, onlyIf.updatedAt] : []));
}

/** Adds an active badge; false when one of that kind is already active. */
export async function grantBadge(db: D1Database, input: { productId: string; kind: BadgeKind; verifiedBy: string | null; evidence: string; now: string }): Promise<boolean> {
  const res = await grantBadgeStatement(db, input).run();
  return res.meta.changes === 1;
}

/**
 * Revokes the active badge of that kind, as a statement for db.batch. With `onlyIf` it applies only when the same
 * batch's product compare-and-set went through and left the product with demo URL `demoUrl`.
 */
export function revokeBadgeStatement(
  db: D1Database,
  input: { productId: string; kind: BadgeKind; reason: string; now: string },
  onlyIf?: ProductGuard & { demoUrl: string | null },
): D1PreparedStatement {
  const guard = onlyIf ? " AND EXISTS (SELECT 1 FROM products WHERE id = ?5 AND status = ?6 AND updated_at = ?7 AND demo_url IS ?8)" : "";
  return db
    .prepare(`UPDATE product_verifications SET revoked_at = ?4, revoke_reason = ?3 WHERE product_id = ?1 AND kind = ?2 AND revoked_at IS NULL${guard}`)
    .bind(input.productId, input.kind, input.reason, input.now, ...(onlyIf ? [onlyIf.productId, onlyIf.status, onlyIf.updatedAt, onlyIf.demoUrl] : []));
}

/** Revokes the active badge of that kind; false when none is active. */
export async function revokeBadge(db: D1Database, input: { productId: string; kind: BadgeKind; reason: string; now: string }): Promise<boolean> {
  const res = await revokeBadgeStatement(db, input).run();
  return res.meta.changes === 1;
}
