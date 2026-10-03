import { describe, expect, it } from "vitest";
import { createUser, findUserByEmail, markLogin } from "../../src/db/users.ts";
import { writeAudit } from "../../src/db/audit.ts";
import { testEnv } from "../helpers.ts";

const NOW = "2026-10-03T09:00:00.000Z";

describe("users", () => {
  it("creates and finds a user by email", async () => {
    const created = await createUser(testEnv.DB, { email: "lan@example.vn", locale: "vi", now: NOW });
    expect(created.id).toMatch(/^[0-9A-Z]{26}$/);
    const found = await findUserByEmail(testEnv.DB, "lan@example.vn");
    expect(found).toMatchObject({ email: "lan@example.vn", locale: "vi", is_admin: 0, status: "active" });
  });

  it("rejects duplicate emails", async () => {
    await createUser(testEnv.DB, { email: "dup@example.vn", locale: "en", now: NOW });
    await expect(createUser(testEnv.DB, { email: "dup@example.vn", locale: "en", now: NOW })).rejects.toThrow();
  });

  it("markLogin sets last_login_at and only ever raises is_admin", async () => {
    const u = await createUser(testEnv.DB, { email: "a@vnx.si", locale: "en", now: NOW });
    await markLogin(testEnv.DB, u.id, { now: NOW, isAdmin: true });
    await markLogin(testEnv.DB, u.id, { now: NOW, isAdmin: false });
    const after = await findUserByEmail(testEnv.DB, "a@vnx.si");
    expect(after).toMatchObject({ last_login_at: NOW, is_admin: 1 });
  });

  it("writes audit rows", async () => {
    await writeAudit(testEnv.DB, { actorUserId: null, action: "test.action", entity: "user", entityId: "x", data: { a: 1 }, now: NOW });
    const row = await testEnv.DB.prepare("SELECT action, data FROM audit_log WHERE entity_id = 'x'").first<{ action: string; data: string }>();
    expect(row).toEqual({ action: "test.action", data: '{"a":1}' });
  });

  it("normalizes email case and whitespace", async () => {
    const created = await createUser(testEnv.DB, { email: "  Mixed@Example.VN ", locale: "en", now: NOW });
    expect(created.email).toBe("mixed@example.vn");
    const found = await findUserByEmail(testEnv.DB, "MIXED@example.vn");
    expect(found?.id).toBe(created.id);
  });

  it("schema rejects non-lowercase emails", async () => {
    await expect(
      testEnv.DB.prepare("INSERT INTO users (id, email, created_at, updated_at) VALUES ('RAW1', 'Upper@Example.VN', ?1, ?1)").bind(NOW).run(),
    ).rejects.toThrow();
  });
});
