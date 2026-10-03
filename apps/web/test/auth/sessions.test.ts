import { describe, expect, it } from "vitest";
import { createSession, deleteSession, getSessionUser, SESSION_TTL_MS } from "../../src/auth/sessions.ts";
import { createUser } from "../../src/db/users.ts";
import { testEnv } from "../helpers.ts";

const now = new Date("2026-10-03T09:00:00Z");

describe("sessions", () => {
  it("resolves the user until expiry, then null", async () => {
    const u = await createUser(testEnv.DB, { email: "s@vnx.si", locale: "en", now: now.toISOString() });
    const sid = await createSession(testEnv.DB, u.id, now);
    expect(await getSessionUser(testEnv.DB, sid, now)).toEqual({ id: u.id, email: "s@vnx.si", locale: "en", isAdmin: false });
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
});
