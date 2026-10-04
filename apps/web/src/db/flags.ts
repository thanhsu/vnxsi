import { FLAG_CACHE_TTL_MS, FLAG_KEYS, isFlagKey, type FlagKey, type FlagState } from "../domain/flags.ts";
import { auditStatement } from "./audit.ts";

type Snapshot = { at: number; flags: FlagState };
// One snapshot per isolate (addendum §3.1: cache 60 s). Another isolate sees a change within one TTL.
let snapshot: Snapshot | null = null;

export function resetFlagCache(): void {
  snapshot = null;
}

/** Reads every flag straight from D1 (no cache). Keys with no row are off; rows with an unknown key are ignored. */
export async function readFlags(db: D1Database): Promise<FlagState> {
  const { results } = await db.prepare("SELECT key, enabled FROM feature_flags").all<{ key: string; enabled: number }>();
  const flags = Object.fromEntries(FLAG_KEYS.map((key) => [key, false])) as FlagState;
  for (const row of results) if (isFlagKey(row.key) && row.enabled === 1) flags[row.key] = true;
  return flags;
}

/**
 * The flag as most callers need it: cached for FLAG_CACHE_TTL_MS. When D1 cannot be read the flag is off (fail closed)
 * and nothing is cached, so the next call tries again.
 */
export async function isFlagEnabled(db: D1Database, key: FlagKey, now: number = Date.now()): Promise<boolean> {
  if (!snapshot || now < snapshot.at || now - snapshot.at >= FLAG_CACHE_TTL_MS) {
    try {
      snapshot = { at: now, flags: await readFlags(db) };
    } catch (err) {
      console.error(JSON.stringify({ event: "flags.read_failed", error: String(err) }));
      return false;
    }
  }
  return snapshot.flags[key];
}

/**
 * Turns a flag on or off and audits it in the same batch. Atomic: the upsert only changes a row whose value differs (a flag
 * with no row is off, so turning it off inserts nothing), and the audit row is written only when that upsert changed the row.
 * Setting the value a flag already has writes nothing.
 */
export async function setFlag(
  db: D1Database,
  input: { key: FlagKey; enabled: boolean; actorUserId: string; now: string },
): Promise<{ changed: boolean }> {
  const value = input.enabled ? 1 : 0;
  const [upsert] = await db.batch<{ key: string }>([
    db
      .prepare(
        `INSERT INTO feature_flags (key, enabled, updated_by, updated_at)
         SELECT ?1, ?2, ?3, ?4 WHERE ?2 = 1 OR EXISTS (SELECT 1 FROM feature_flags WHERE key = ?1)
         ON CONFLICT(key) DO UPDATE SET enabled = excluded.enabled, updated_by = excluded.updated_by, updated_at = excluded.updated_at
         WHERE feature_flags.enabled != excluded.enabled
         RETURNING key`,
      )
      .bind(input.key, value, input.actorUserId, input.now),
    auditStatement(
      db,
      { actorUserId: input.actorUserId, action: "flag.set", entity: "feature_flag", entityId: input.key, data: { enabled: input.enabled }, now: input.now },
      { flagKey: input.key, enabled: value, updatedAt: input.now, updatedBy: input.actorUserId },
    ),
  ]);
  snapshot = null;
  return { changed: (upsert?.results.length ?? 0) > 0 };
}
