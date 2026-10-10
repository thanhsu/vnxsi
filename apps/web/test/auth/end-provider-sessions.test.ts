import { describe, expect, it } from "vitest";
import { endProviderSessionsStatement } from "../../src/auth/sessions.ts";
import { unlinkIdentity } from "../../src/db/identities.ts";
import type { OAuthProvider, SessionMethod } from "../../src/domain/identity.ts";
import { signIn } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";
import { linkedUser } from "../oauth-flow.ts";

let counter = 0;
const tag = () => `${++counter}-${Math.random().toString(36).slice(2, 8)}`; // D1 is shared: per-test addresses, no global counts
const NOW = "2026-10-10T09:00:00.000Z";
const methodsOf = async (userId: string) =>
  (await testEnv.DB.prepare("SELECT method FROM sessions WHERE user_id = ?1 ORDER BY method, id_hash").bind(userId).all<{ method: string }>()).results.map((r) => r.method);
const audits = async (userId: string) =>
  (await testEnv.DB.prepare("SELECT data FROM audit_log WHERE entity = 'user' AND entity_id = ?1 AND action = 'auth.identity.unlink'").bind(userId).all<{ data: string }>()).results.map((r) => r.data);
const unlink = (userId: string, provider: OAuthProvider) =>
  unlinkIdentity(testEnv.DB, { userId, provider, now: NOW, endSessions: endProviderSessionsStatement(testEnv.DB, { userId, provider }) });
const sessionFor = (email: string, method: SessionMethod) => signIn(email, { method });

describe("unlinkIdentity ends the provider's sessions in its own batch (VNX-2605c)", () => {
  it("ends the user's sessions of that provider and only those; the audit row stays { provider }", async () => {
    const email = `lan-${tag()}@example.com`;
    const { user } = await linkedUser(email, "github", { subject: `s-${tag()}`, label: `l-${tag()}` });
    await linkedUser(email, "google", { subject: `s-${tag()}`, label: `g-${tag()}@gmail.example` });
    for (const m of ["magic_link", "oauth_github", "oauth_github", "oauth_google", "oauth_linkedin"] as const) await sessionFor(email, m);
    expect(await unlink(user.id, "github")).toMatchObject({ provider: "github" });
    expect(await methodsOf(user.id)).toEqual(["magic_link", "oauth_google", "oauth_linkedin"]);
    expect(await audits(user.id)).toEqual(['{"provider":"github"}']); // no session count, no hash
  });

  it("never touches another user's sessions, even of the same provider", async () => {
    const a = await linkedUser(`a-${tag()}@example.com`, "github", { subject: `s-${tag()}`, label: `a-${tag()}` });
    const b = await linkedUser(`b-${tag()}@example.com`, "github", { subject: `s-${tag()}`, label: `b-${tag()}` });
    await sessionFor(a.user.email, "oauth_github");
    await sessionFor(b.user.email, "oauth_github");
    await unlink(a.user.id, "github");
    expect(await methodsOf(a.user.id)).toEqual([]);
    expect(await methodsOf(b.user.id)).toEqual(["oauth_github"]);
    expect(await audits(b.user.id)).toEqual([]);
  });

  it("an unlink that does not happen (notLinked) deletes nothing and audits nothing", async () => {
    const email = `lan-${tag()}@example.com`;
    const { user } = await linkedUser(email, "google", { subject: `s-${tag()}`, label: `g-${tag()}@gmail.example` });
    await sessionFor(email, "oauth_github"); // a session of a provider the user has no identity for
    await sessionFor(email, "oauth_google");
    expect(await unlink(user.id, "github")).toBeNull();
    expect(await methodsOf(user.id)).toEqual(["oauth_github", "oauth_google"]);
    expect(await audits(user.id)).toEqual([]);
  });

  it("a user who does not hold the identity cannot end the holder's sessions", async () => {
    const holder = await linkedUser(`h-${tag()}@example.com`, "github", { subject: `s-${tag()}`, label: `h-${tag()}` });
    const other = await linkedUser(`o-${tag()}@example.com`, "google", { subject: `s-${tag()}`, label: `o-${tag()}@gmail.example` });
    await sessionFor(holder.user.email, "oauth_github");
    expect(await unlink(other.user.id, "github")).toBeNull();
    expect(await methodsOf(holder.user.id)).toEqual(["oauth_github"]);
  });

  it("is atomic: when the identity DELETE fails, the sessions, the row and the audit are all untouched", async () => {
    const email = `lan-${tag()}@example.com`;
    const label = `boom-${tag()}`;
    const { user } = await linkedUser(email, "github", { subject: `s-${tag()}`, label });
    await sessionFor(email, "oauth_github");
    await sessionFor(email, "oauth_github");
    // A trigger that aborts only the DELETE of this row: the batch is one transaction, so nothing before it may stick.
    await testEnv.DB.prepare(`CREATE TRIGGER vnx_test_unlink_boom BEFORE DELETE ON user_identities WHEN OLD.label = '${label}' BEGIN SELECT RAISE(ABORT, 'boom'); END`).run();
    try {
      await expect(unlink(user.id, "github")).rejects.toThrow();
      expect(await methodsOf(user.id)).toEqual(["oauth_github", "oauth_github"]);
      expect((await testEnv.DB.prepare("SELECT count(*) AS n FROM user_identities WHERE user_id = ?1").bind(user.id).first<{ n: number }>())?.n).toBe(1);
      expect(await audits(user.id)).toEqual([]);
    } finally {
      await testEnv.DB.prepare("DROP TRIGGER IF EXISTS vnx_test_unlink_boom").run();
    }
    expect(await unlink(user.id, "github")).not.toBeNull(); // without the trigger the same call goes through
    expect(await methodsOf(user.id)).toEqual([]);
  });
});
