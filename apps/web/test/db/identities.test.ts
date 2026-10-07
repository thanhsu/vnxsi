import { beforeEach, describe, expect, it } from "vitest";
import { findIdentityByProviderSubject, linkIdentity, listIdentitiesForUser, touchIdentityLogin, unlinkIdentity } from "../../src/db/identities.ts";
import { ensureUser } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const NOW = "2026-10-07T09:00:00.000Z";
const LATER = "2026-10-08T09:00:00.000Z";

let seq = 0;
const newUser = () => ensureUser(`ident-${++seq}@vnx.si`);
const audits = async (userId: string, action: string) =>
  (await testEnv.DB.prepare("SELECT data FROM audit_log WHERE entity = 'user' AND entity_id = ?1 AND action = ?2 ORDER BY id").bind(userId, action).all<{ data: string }>()).results.map((r) => r.data);
const rawInsert = (id: string, userId: string, provider: string, subject: string, show = 0) =>
  testEnv.DB
    .prepare("INSERT INTO user_identities (id, user_id, provider, provider_subject, label, show_on_profile, linked_at, updated_at) VALUES (?1, ?2, ?3, ?4, 'x', ?5, ?6, ?6)")
    .bind(id, userId, provider, subject, show, NOW)
    .run();

describe("user_identities (ADR-012 §2, §4)", () => {
  beforeEach(async () => {
    await testEnv.DB.prepare("DELETE FROM user_identities").run();
  });

  it("links an account the user does not have and audits it with the provider only", async () => {
    const user = await newUser();
    const result = await linkIdentity(testEnv.DB, { userId: user.id, provider: "github", subject: "1234567", label: "octocat", now: NOW });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.identity).toMatchObject({ userId: user.id, provider: "github", subject: "1234567", label: "octocat", showOnProfile: false, linkedAt: NOW, lastUsedAt: null, updatedAt: NOW });
    expect(await findIdentityByProviderSubject(testEnv.DB, "github", "1234567")).toEqual(result.identity);
    expect(await listIdentitiesForUser(testEnv.DB, user.id)).toEqual([result.identity]);
    // No label (an e-mail for Google and LinkedIn), no subject, no token.
    expect(await audits(user.id, "auth.identity.link")).toEqual(['{"provider":"github"}']);
  });

  it("treats the same user linking the same account again as already linked, without a second audit row", async () => {
    const user = await newUser();
    await linkIdentity(testEnv.DB, { userId: user.id, provider: "google", subject: "g-1", label: "a@example.com", now: NOW });
    const again = await linkIdentity(testEnv.DB, { userId: user.id, provider: "google", subject: "g-1", label: "changed@example.com", now: LATER });
    expect(again).toEqual({ ok: false, reason: "already_linked" });
    expect(await audits(user.id, "auth.identity.link")).toHaveLength(1);
    expect((await findIdentityByProviderSubject(testEnv.DB, "google", "g-1"))?.label).toBe("a@example.com");
  });

  it("refuses a provider account that belongs to another user, and links nothing for the second user", async () => {
    const first = await newUser();
    const second = await newUser();
    await linkIdentity(testEnv.DB, { userId: first.id, provider: "google", subject: "g-shared", label: "owner@example.com", now: NOW });
    // The label equal to the second user's own e-mail changes nothing: e-mails never link accounts (ADR-012 decision 2).
    const refused = await linkIdentity(testEnv.DB, { userId: second.id, provider: "google", subject: "g-shared", label: second.email, now: LATER });
    expect(refused).toEqual({ ok: false, reason: "provider_account_taken" });
    expect(await listIdentitiesForUser(testEnv.DB, second.id)).toEqual([]);
    expect((await findIdentityByProviderSubject(testEnv.DB, "google", "g-shared"))?.userId).toBe(first.id);
    expect(await audits(second.id, "auth.identity.link")).toEqual([]);
  });

  it("allows one account per provider per user, and one of each provider", async () => {
    const user = await newUser();
    await linkIdentity(testEnv.DB, { userId: user.id, provider: "google", subject: "g-1", label: "a@example.com", now: NOW });
    expect(await linkIdentity(testEnv.DB, { userId: user.id, provider: "google", subject: "g-2", label: "b@example.com", now: NOW })).toEqual({ ok: false, reason: "user_has_provider" });
    expect((await linkIdentity(testEnv.DB, { userId: user.id, provider: "github", subject: "42", label: "octocat", now: NOW })).ok).toBe(true);
    expect((await linkIdentity(testEnv.DB, { userId: user.id, provider: "linkedin", subject: "li-1", label: "lan@example.com", now: NOW })).ok).toBe(true);
    expect((await listIdentitiesForUser(testEnv.DB, user.id)).map((i) => i.provider)).toEqual(["github", "google", "linkedin"]);
    expect(await audits(user.id, "auth.identity.link")).toHaveLength(3);
  });

  it("unlinks an account the user holds, audits it, and lets the account be linked again", async () => {
    const user = await newUser();
    await linkIdentity(testEnv.DB, { userId: user.id, provider: "linkedin", subject: "li-1", label: "lan@example.com", now: NOW });
    const removed = await unlinkIdentity(testEnv.DB, { userId: user.id, provider: "linkedin", now: LATER });
    expect(removed).toMatchObject({ provider: "linkedin", subject: "li-1" });
    expect(await listIdentitiesForUser(testEnv.DB, user.id)).toEqual([]);
    expect(await audits(user.id, "auth.identity.unlink")).toEqual(['{"provider":"linkedin"}']);
    expect(await unlinkIdentity(testEnv.DB, { userId: user.id, provider: "linkedin", now: LATER })).toBeNull();
    expect(await audits(user.id, "auth.identity.unlink")).toHaveLength(1);
    expect((await linkIdentity(testEnv.DB, { userId: user.id, provider: "linkedin", subject: "li-1", label: "lan@example.com", now: LATER })).ok).toBe(true);
  });

  it("never unlinks another user's account", async () => {
    const owner = await newUser();
    const other = await newUser();
    await linkIdentity(testEnv.DB, { userId: owner.id, provider: "github", subject: "77", label: "octocat", now: NOW });
    expect(await unlinkIdentity(testEnv.DB, { userId: other.id, provider: "github", now: LATER })).toBeNull();
    expect(await listIdentitiesForUser(testEnv.DB, owner.id)).toHaveLength(1);
    expect(await audits(other.id, "auth.identity.unlink")).toEqual([]);
  });

  it("refreshes the label and the last-used time on a sign-in", async () => {
    const user = await newUser();
    const linked = await linkIdentity(testEnv.DB, { userId: user.id, provider: "github", subject: "9", label: "old-login", now: NOW });
    if (!linked.ok) throw new Error("link failed");
    await touchIdentityLogin(testEnv.DB, { id: linked.identity.id, label: "new-login", now: LATER });
    const [identity] = await listIdentitiesForUser(testEnv.DB, user.id);
    expect(identity).toMatchObject({ label: "new-login", lastUsedAt: LATER, updatedAt: LATER, linkedAt: NOW, subject: "9" });
  });

  it("enforces the rules in SQL as well: provider list, 0/1 flag, one account per provider, one user per account", async () => {
    const a = await newUser();
    const b = await newUser();
    await expect(rawInsert("i-twitter", a.id, "twitter", "t-1")).rejects.toThrow();
    await expect(rawInsert("i-flag", a.id, "google", "g-flag", 2)).rejects.toThrow();
    await expect(rawInsert("i-empty", a.id, "google", "")).rejects.toThrow();
    await rawInsert("i-1", a.id, "google", "g-1");
    await expect(rawInsert("i-2", b.id, "google", "g-1")).rejects.toThrow(); // same provider account, other user
    await expect(rawInsert("i-3", a.id, "google", "g-2")).rejects.toThrow(); // same user, same provider, other account
    await rawInsert("i-4", b.id, "github", "g-1"); // the same subject at another provider is a different account
  });

  it("has no column that could hold a token (ADR-012 §1)", async () => {
    const { results } = await testEnv.DB.prepare("PRAGMA table_info(user_identities)").all<{ name: string }>();
    expect(results.map((r) => r.name)).toEqual(["id", "user_id", "provider", "provider_subject", "label", "show_on_profile", "linked_at", "last_used_at", "updated_at"]);
  });

  it("refuses an empty label and one of 255 characters, in SQL and through linkIdentity, and accepts 254 (CHECK 1-254)", async () => {
    const user = await newUser();
    const insertLabel = (id: string, label: string) =>
      testEnv.DB
        .prepare("INSERT INTO user_identities (id, user_id, provider, provider_subject, label, linked_at, updated_at) VALUES (?1, ?2, 'google', ?1, ?3, ?4, ?4)")
        .bind(id, user.id, label, NOW)
        .run();
    await expect(insertLabel("label-empty", "")).rejects.toThrow();
    await expect(insertLabel("label-long", "x".repeat(255))).rejects.toThrow();
    await expect(linkIdentity(testEnv.DB, { userId: user.id, provider: "google", subject: "g-empty", label: "", now: NOW })).rejects.toThrow();
    await expect(linkIdentity(testEnv.DB, { userId: user.id, provider: "google", subject: "g-long", label: "x".repeat(255), now: NOW })).rejects.toThrow();
    expect((await linkIdentity(testEnv.DB, { userId: user.id, provider: "google", subject: "g-max", label: "x".repeat(254), now: NOW })).ok).toBe(true);
    expect(await listIdentitiesForUser(testEnv.DB, user.id)).toHaveLength(1);
  });
});
