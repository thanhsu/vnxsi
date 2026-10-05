import { beforeEach, describe, expect, it } from "vitest";
import { isFlagEnabled, readFlags, resetFlagCache, setFlag } from "../../src/db/flags.ts";
import { FLAG_KEYS } from "../../src/domain/flags.ts";
import { ensureUser } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const NOW = "2026-10-05T00:00:00.000Z";
const rawSet = (key: string, enabled: 0 | 1) =>
  testEnv.DB.prepare("INSERT INTO feature_flags (key, enabled, updated_by, updated_at) VALUES (?1, ?2, NULL, ?3) ON CONFLICT(key) DO UPDATE SET enabled = excluded.enabled").bind(key, enabled, NOW).run();
const auditCount = async (key: string) =>
  (await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'flag.set' AND entity_id = ?1").bind(key).first<{ n: number }>())?.n ?? 0;

describe("feature flags (addendum §3.1)", () => {
  beforeEach(async () => {
    await testEnv.DB.prepare("DELETE FROM feature_flags").run();
    resetFlagCache();
  });

  it("are all off when there is no row", async () => {
    const flags = await readFlags(testEnv.DB);
    expect(Object.keys(flags)).toEqual([...FLAG_KEYS]);
    expect(Object.values(flags).every((v) => v === false)).toBe(true);
    expect(await isFlagEnabled(testEnv.DB, "affiliate")).toBe(false);
  });

  it("ignores rows with an unknown key", async () => {
    await rawSet("made_up", 1);
    expect(Object.keys(await readFlags(testEnv.DB))).toEqual([...FLAG_KEYS]);
  });

  it("turns on and off with one audit row per real change and none for a no-op", async () => {
    const admin = await ensureUser("flags-admin@vnx.si");
    // Each call has its own timestamp: ULIDs are not monotonic inside one millisecond, so order is never asserted from ids.
    const at = (n: number) => new Date(Date.parse(NOW) + n * 1000).toISOString();
    expect(await setFlag(testEnv.DB, { key: "affiliate", enabled: false, actorUserId: admin.id, now: at(1) })).toEqual({ changed: false });
    expect(await auditCount("affiliate")).toBe(0);
    expect((await readFlags(testEnv.DB)).affiliate).toBe(false);

    expect(await setFlag(testEnv.DB, { key: "affiliate", enabled: true, actorUserId: admin.id, now: at(2) })).toEqual({ changed: true });
    expect((await readFlags(testEnv.DB)).affiliate).toBe(true);
    expect(await setFlag(testEnv.DB, { key: "affiliate", enabled: true, actorUserId: admin.id, now: at(3) })).toEqual({ changed: false });
    expect(await setFlag(testEnv.DB, { key: "affiliate", enabled: false, actorUserId: admin.id, now: at(4) })).toEqual({ changed: true });
    expect(await auditCount("affiliate")).toBe(2);

    const { results } = await testEnv.DB.prepare("SELECT actor_user_id, entity, data FROM audit_log WHERE action = 'flag.set' AND entity_id = 'affiliate'").all<{ actor_user_id: string; entity: string; data: string }>();
    expect(results.map((r) => r.actor_user_id)).toEqual([admin.id, admin.id]);
    expect(results.every((r) => r.entity === "feature_flag")).toBe(true);
    expect(results.map((r) => (JSON.parse(r.data) as { enabled: boolean }).enabled).sort()).toEqual([false, true]);
  });

  it("is atomic: two concurrent identical sets change once and audit once", async () => {
    const admin = await ensureUser("flags-admin3@vnx.si");
    const results = await Promise.all([
      setFlag(testEnv.DB, { key: "ads", enabled: true, actorUserId: admin.id, now: NOW }),
      setFlag(testEnv.DB, { key: "ads", enabled: true, actorUserId: admin.id, now: NOW }),
    ]);
    expect(results.filter((r) => r.changed)).toHaveLength(1);
    expect(await auditCount("ads")).toBe(1);
  });

  it("serves a cached value for 60 s and re-reads at 60 s", async () => {
    const t0 = 1_000_000;
    expect(await isFlagEnabled(testEnv.DB, "affiliate", t0)).toBe(false);
    await rawSet("affiliate", 1);
    expect(await isFlagEnabled(testEnv.DB, "affiliate", t0 + 59_999)).toBe(false);
    expect(await isFlagEnabled(testEnv.DB, "affiliate", t0 + 60_000)).toBe(true);
    await rawSet("affiliate", 0);
    expect(await isFlagEnabled(testEnv.DB, "affiliate", t0 + 60_001)).toBe(true);
    expect(await isFlagEnabled(testEnv.DB, "affiliate", t0 + 120_000)).toBe(false);
  });

  it("drops the cache of this isolate when a flag is set", async () => {
    const admin = await ensureUser("flags-admin2@vnx.si");
    const t0 = 2_000_000;
    expect(await isFlagEnabled(testEnv.DB, "partner_referral", t0)).toBe(false);
    await setFlag(testEnv.DB, { key: "partner_referral", enabled: true, actorUserId: admin.id, now: NOW });
    expect(await isFlagEnabled(testEnv.DB, "partner_referral", t0 + 1)).toBe(true);
  });

  it("does not cache a read that started before a set and finished after it", async () => {
    const admin = await ensureUser("flags-admin4@vnx.si");
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const slow = {
      prepare: (sql: string) => {
        const stmt = testEnv.DB.prepare(sql);
        return { all: async () => { const res = await stmt.all(); await gate; return res; } };
      },
    } as unknown as D1Database;
    const t0 = 4_000_000;
    const stale = isFlagEnabled(slow, "affiliate", t0); // reads "off", then waits at the gate
    await new Promise((r) => setTimeout(r, 20));
    await setFlag(testEnv.DB, { key: "affiliate", enabled: true, actorUserId: admin.id, now: NOW });
    release();
    expect(await stale).toBe(false);
    expect(await isFlagEnabled(testEnv.DB, "affiliate", t0 + 1)).toBe(true);
  });

  it("fails closed when D1 cannot be read, and does not cache the failure", async () => {
    const broken = { prepare: () => { throw new Error("d1 down"); } } as unknown as D1Database;
    expect(await isFlagEnabled(broken, "affiliate", 3_000_000)).toBe(false);
    await rawSet("affiliate", 1);
    expect(await isFlagEnabled(testEnv.DB, "affiliate", 3_000_001)).toBe(true);
  });
});
