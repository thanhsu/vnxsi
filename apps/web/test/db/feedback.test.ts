import { describe, expect, it } from "vitest";
import {
  countFeedback,
  createFeedback,
  findFeedbackById,
  listFeedback,
  markFeedbackNotified,
  setFeedbackStatusStatement,
  type NewFeedback,
} from "../../src/db/feedback.ts";
import { ensureUser } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const db = () => testEnv.DB;
const MESSAGE = "We would like to list our booking product on VNX.SI.";

function input(overrides: Partial<NewFeedback> = {}): NewFeedback {
  return { role: "builder", kind: "question", name: "Lan", email: "fb-db@vnx.si", message: MESSAGE, locale: "vi", userId: null, now: "2026-10-04T08:00:00.000Z", ...overrides };
}

describe("0009_feedback migration (plan VNX-0710)", () => {
  it("creates the feedback table with the planned columns and index", async () => {
    const cols = await db().prepare("PRAGMA table_info(feedback)").all<{ name: string; notnull: number; pk: number; dflt_value: string | null }>();
    const byName = Object.fromEntries(cols.results.map((c) => [c.name, c]));
    expect(Object.keys(byName)).toEqual([
      "id",
      "role",
      "kind",
      "name",
      "email",
      "message",
      "locale",
      "user_id",
      "status",
      "notified_at",
      "handled_at",
      "handled_by",
      "created_at",
      "updated_at",
    ]);
    expect(byName.id?.pk).toBe(1);
    for (const name of ["role", "kind", "email", "message", "locale", "status", "created_at", "updated_at"]) expect(byName[name]?.notnull, name).toBe(1);
    for (const name of ["name", "user_id", "notified_at", "handled_at", "handled_by"]) expect(byName[name]?.notnull, name).toBe(0);
    expect(byName.status?.dflt_value).toBe("'new'");
    const index = await db().prepare("PRAGMA index_info(idx_feedback_status_created)").all<{ name: string }>();
    expect(index.results.map((r) => r.name)).toEqual(["status", "created_at"]);
  });

  it("refuses unknown roles, kinds, statuses and upper-case e-mails", async () => {
    const insert = (role: string, kind: string, email: string, status = "new") =>
      db()
        .prepare("INSERT INTO feedback (id, role, kind, email, message, locale, status, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, 'm', 'en', ?5, 't', 't')")
        .bind(crypto.randomUUID(), role, kind, email, status)
        .run();
    await expect(insert("admin", "question", "a@b.co")).rejects.toThrow();
    await expect(insert("client", "praise", "a@b.co")).rejects.toThrow();
    await expect(insert("client", "question", "A@b.co")).rejects.toThrow();
    await expect(insert("client", "question", "a@b.co", "open")).rejects.toThrow();
    await expect(insert("other", "partnership", "ok@b.co")).resolves.toBeDefined();
  });
});

describe("db/feedback", () => {
  it("creates a new row, finds it by id and marks it notified", async () => {
    const user = await ensureUser("fb-db-user@vnx.si");
    const created = await createFeedback(db(), input({ userId: user.id }));
    expect(created).toMatchObject({ role: "builder", kind: "question", name: "Lan", email: "fb-db@vnx.si", message: MESSAGE, locale: "vi", userId: user.id, status: "new", notifiedAt: null, handledAt: null, handledBy: null });
    expect(created.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(await findFeedbackById(db(), created.id)).toEqual(created);
    await markFeedbackNotified(db(), created.id, "2026-10-04T08:00:05.000Z");
    expect((await findFeedbackById(db(), created.id))?.notifiedAt).toBe("2026-10-04T08:00:05.000Z");
    expect(await findFeedbackById(db(), "missing")).toBeNull();
  });

  it("lists by status, newest first, with limit and offset, and counts", async () => {
    const tag = `fb-list-${crypto.randomUUID().slice(0, 8)}@vnx.si`;
    const older = await createFeedback(db(), input({ email: tag, now: "2030-01-01T00:00:00.000Z" }));
    const newer = await createFeedback(db(), input({ email: tag, now: "2030-01-02T00:00:00.000Z" }));
    const before = await countFeedback(db(), "new");
    const page = await listFeedback(db(), "new", { limit: 2, offset: 0 });
    expect(page.map((f) => f.id)).toEqual([newer.id, older.id]);
    expect((await listFeedback(db(), "new", { limit: 1, offset: 1 })).map((f) => f.id)).toEqual([older.id]);

    const now = "2030-01-03T00:00:00.000Z";
    const admin = await ensureUser("fb-db-admin@vnx.si");
    const moved = await setFeedbackStatusStatement(db(), { id: newer.id, from: "new", to: "handled", by: admin.id, now }).first();
    expect(moved).not.toBeNull();
    expect(await findFeedbackById(db(), newer.id)).toMatchObject({ status: "handled", handledAt: now, handledBy: admin.id, updatedAt: now });
    expect(await countFeedback(db(), "new")).toBe(before - 1);
    expect((await listFeedback(db(), "handled", { limit: 50, offset: 0 })).map((f) => f.id)).toContain(newer.id);
  });

  it("changes status only from the expected one, and clears handled_* on reopen", async () => {
    const admin = await ensureUser("fb-db-admin2@vnx.si");
    const item = await createFeedback(db(), input());
    const lost = await setFeedbackStatusStatement(db(), { id: item.id, from: "handled", to: "new", by: admin.id, now: "2030-02-01T00:00:00.000Z" }).first();
    expect(lost).toBeNull();
    await setFeedbackStatusStatement(db(), { id: item.id, from: "new", to: "spam", by: admin.id, now: "2030-02-02T00:00:00.000Z" }).run();
    expect(await findFeedbackById(db(), item.id)).toMatchObject({ status: "spam", handledBy: admin.id });
    await setFeedbackStatusStatement(db(), { id: item.id, from: "spam", to: "new", by: admin.id, now: "2030-02-03T00:00:00.000Z" }).run();
    expect(await findFeedbackById(db(), item.id)).toMatchObject({ status: "new", handledAt: null, handledBy: null, updatedAt: "2030-02-03T00:00:00.000Z" });
  });
});
