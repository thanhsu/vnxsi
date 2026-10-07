import { describe, expect, it } from "vitest";
import { createSession, deleteSession, getSessionUser, SESSION_TTL_MS } from "../../src/auth/sessions.ts";
import { createUser } from "../../src/db/users.ts";
import { testEnv } from "../helpers.ts";

const now = new Date("2026-10-03T09:00:00Z");

describe("sessions", () => {
  it("resolves the user until expiry, then null", async () => {
    const u = await createUser(testEnv.DB, { email: "s@vnx.si", locale: "en", now: now.toISOString() });
    const sid = await createSession(testEnv.DB, u.id, now);
    expect(await getSessionUser(testEnv.DB, sid, now)).toEqual({ id: u.id, email: "s@vnx.si", locale: "en", isAdmin: false, method: "magic_link" });
    expect(await getSessionUser(testEnv.DB, sid, new Date(now.getTime() + SESSION_TTL_MS + 1))).toBeNull();
  });

  it("ignores sessions of suspended users and deleted sessions", async () => {
    const u = await createUser(testEnv.DB, { email: "sus@vnx.si", locale: "en", now: now.toISOString() });
    const sid = await createSession(testEnv.DB, u.id, now);
    await testEnv.DB.prepare("UPDATE users SET status = 'suspended' WHERE id = ?1").bind(u.id).run();
    expect(await getSessionUser(testEnv.DB, sid, now)).toBeNull();

    const v = await createUser(testEnv.DB, { email: "del@vnx.si", locale: "en", now: now.toISOString() });
    const sid2 = await createSession(testEnv.DB, v.id, now);
    await deleteSession(testEnv.DB, sid2);
    expect(await getSessionUser(testEnv.DB, sid2, now)).toBeNull();
  });

  it("records how a session was created: magic_link by default, the OAuth method when given (ADR-012 §2)", async () => {
    const u = await createUser(testEnv.DB, { email: "method@vnx.si", locale: "en", now: now.toISOString() });
    const byDefault = await createSession(testEnv.DB, u.id, now);
    const viaGithub = await createSession(testEnv.DB, u.id, now, "oauth_github");
    expect((await getSessionUser(testEnv.DB, byDefault, now))?.method).toBe("magic_link");
    expect((await getSessionUser(testEnv.DB, viaGithub, now))?.method).toBe("oauth_github");
  });

  it("gives a row inserted without a method the magic_link default, and refuses a method outside the list", async () => {
    const u = await createUser(testEnv.DB, { email: "legacy@vnx.si", locale: "en", now: now.toISOString() });
    await testEnv.DB.prepare("INSERT INTO sessions (id_hash, user_id, expires_at, created_at) VALUES ('legacy-hash', ?1, '2099-01-01T00:00:00.000Z', ?2)").bind(u.id, now.toISOString()).run();
    const row = await testEnv.DB.prepare("SELECT method FROM sessions WHERE id_hash = 'legacy-hash'").first<{ method: string }>();
    expect(row?.method).toBe("magic_link");
    await expect(
      testEnv.DB.prepare("INSERT INTO sessions (id_hash, user_id, expires_at, created_at, method) VALUES ('bad-hash', ?1, '2099-01-01T00:00:00.000Z', ?2, 'oauth_twitter')").bind(u.id, now.toISOString()).run(),
    ).rejects.toThrow();
  });
});
