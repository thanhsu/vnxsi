import { describe, expect, it } from "vitest";
import {
  acceptOpsInviteStatements,
  cancelOpsInviteStatement,
  createOpsInviteStatement,
  deleteOpsMemberStatement,
  expireOpsInvitesStatement,
  findOpsAccess,
  findOpsInviteById,
  findOpsMember,
  findPendingOpsInvite,
  listOpsInvites,
  listOpsMembers,
  setOpsMemberRoleStatement,
} from "../../src/db/ops-members.ts";
import { setUserStatusStatement } from "../../src/db/users.ts";
import { INVITE_TTL_MS } from "../../src/domain/ops.ts";
import { ensureUser } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const db = () => testEnv.DB;
const tag = () => crypto.randomUUID().slice(0, 8);
const plus = (iso: string, ms: number) => new Date(Date.parse(iso) + ms).toISOString();

type Column = { name: string; notnull: number; pk: number; dflt_value: string | null };
async function columns(table: string): Promise<Record<string, Column>> {
  const cols = await db().prepare(`PRAGMA table_info(${table})`).all<Column>();
  return Object.fromEntries(cols.results.map((c) => [c.name, c]));
}

async function invite(input: { email: string; role?: "operator" | "content" | "viewer"; createdBy: string; now: string }) {
  const created = await createOpsInviteStatement(db(), { role: "operator", ...input }).statement.first<{ id: string }>();
  if (!created) throw new Error("invite not created");
  const row = await findOpsInviteById(db(), created.id);
  if (!row) throw new Error("invite not found");
  return row;
}

async function memberCount(): Promise<number> {
  return (await db().prepare("SELECT COUNT(*) AS n FROM ops_members").first<{ n: number }>())!.n;
}

describe("0013_ops_members migration (plan O1, VNX-2501)", () => {
  it("creates ops_members with the planned columns", async () => {
    const byName = await columns("ops_members");
    expect(Object.keys(byName)).toEqual(["user_id", "role", "granted_by", "granted_at", "updated_at"]);
    expect(byName.user_id?.pk).toBe(1);
    for (const name of ["role", "granted_by", "granted_at", "updated_at"]) expect(byName[name]?.notnull, name).toBe(1);
  });

  it("creates ops_member_invites with the planned columns and the pending-per-email unique index", async () => {
    const byName = await columns("ops_member_invites");
    expect(Object.keys(byName)).toEqual(["id", "email", "role", "created_by", "status", "expires_at", "accepted_by", "created_at", "updated_at"]);
    expect(byName.id?.pk).toBe(1);
    for (const name of ["email", "role", "created_by", "status", "expires_at", "created_at", "updated_at"]) expect(byName[name]?.notnull, name).toBe(1);
    expect(byName.accepted_by?.notnull).toBe(0);
    expect(byName.status?.dflt_value).toBe("'pending'");

    const indexes = await db().prepare("PRAGMA index_list(ops_member_invites)").all<{ name: string; unique: number; partial: number }>();
    const pending = indexes.results.find((i) => i.name === "uq_ops_invite_pending");
    expect(pending).toMatchObject({ unique: 1, partial: 1 });
    const cols = await db().prepare("PRAGMA index_info(uq_ops_invite_pending)").all<{ name: string }>();
    expect(cols.results.map((r) => r.name)).toEqual(["email"]);
  });

  it("has no owner role in either table, and refuses unknown statuses and upper-case e-mails", async () => {
    const owner = await ensureUser(`ops-db-chk-owner-${tag()}@vnx.si`);
    const member = await ensureUser(`ops-db-chk-member-${tag()}@vnx.si`);
    const now = "2026-10-05T08:00:00.000Z";
    const addMember = (role: string) =>
      db().prepare("INSERT INTO ops_members (user_id, role, granted_by, granted_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)").bind(member.id, role, owner.id, now).run();
    await expect(addMember("owner")).rejects.toThrow();
    await expect(addMember("admin")).rejects.toThrow();
    await expect(addMember("viewer")).resolves.toBeDefined();

    const addInvite = (email: string, role: string, status = "pending") =>
      db()
        .prepare("INSERT INTO ops_member_invites (id, email, role, created_by, status, expires_at, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)")
        .bind(crypto.randomUUID(), email, role, owner.id, status, plus(now, INVITE_TTL_MS), now)
        .run();
    const email = `ops-db-chk-${tag()}@vnx.si`;
    await expect(addInvite(email, "owner")).rejects.toThrow();
    await expect(addInvite(email.toUpperCase(), "viewer")).rejects.toThrow();
    await expect(addInvite(email, "viewer", "open")).rejects.toThrow();
    await expect(addInvite(email, "viewer", "cancelled")).resolves.toBeDefined();
    await expect(addInvite(email, "viewer")).resolves.toBeDefined();
    // A second pending invitation for the same e-mail is refused by the index; other statuses are not.
    await expect(addInvite(email, "content")).rejects.toThrow();
    await expect(addInvite(email, "content", "expired")).resolves.toBeDefined();
  });
});

describe("db/ops-members: invitations", () => {
  it("creates a pending invitation that expires seven days later, with a normalised e-mail", async () => {
    const owner = await ensureUser(`ops-db-own-${tag()}@vnx.si`);
    const email = `ops-db-new-${tag()}@vnx.si`;
    const now = "2026-10-05T08:00:00.000Z";
    const { id, statement } = createOpsInviteStatement(db(), { email: `  ${email.toUpperCase()} `, role: "content", createdBy: owner.id, now });
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(await statement.first()).toMatchObject({ id });
    expect(await findOpsInviteById(db(), id)).toEqual({
      id,
      email,
      role: "content",
      createdBy: owner.id,
      status: "pending",
      expiresAt: "2026-10-12T08:00:00.000Z",
      acceptedBy: null,
      createdAt: now,
      updatedAt: now,
    });
    expect((await findPendingOpsInvite(db(), email.toUpperCase()))?.id).toBe(id);
    expect(await findOpsInviteById(db(), "missing")).toBeNull();
    expect(await findPendingOpsInvite(db(), `ops-db-none-${tag()}@vnx.si`)).toBeNull();
  });

  it("writes nothing for a second pending invitation to the same e-mail, and allows one after a cancel", async () => {
    const owner = await ensureUser(`ops-db-own-${tag()}@vnx.si`);
    const email = `ops-db-dup-${tag()}@vnx.si`;
    const first = await invite({ email, createdBy: owner.id, now: "2026-10-05T08:00:00.000Z" });
    const second = createOpsInviteStatement(db(), { email, role: "viewer", createdBy: owner.id, now: "2026-10-05T09:00:00.000Z" });
    expect(await second.statement.first()).toBeNull();
    expect(await findOpsInviteById(db(), second.id)).toBeNull();
    const rows = await db().prepare("SELECT COUNT(*) AS n FROM ops_member_invites WHERE email = ?1").bind(email).first<{ n: number }>();
    expect(rows?.n).toBe(1);

    expect(await cancelOpsInviteStatement(db(), { id: first.id, now: "2026-10-05T10:00:00.000Z" }).first()).toMatchObject({ id: first.id });
    expect(await findOpsInviteById(db(), first.id)).toMatchObject({ status: "cancelled", updatedAt: "2026-10-05T10:00:00.000Z" });
    const third = await invite({ email, role: "viewer", createdBy: owner.id, now: "2026-10-05T11:00:00.000Z" });
    expect(third.status).toBe("pending");
  });

  it("cancels only a pending invitation", async () => {
    const owner = await ensureUser(`ops-db-own-${tag()}@vnx.si`);
    const item = await invite({ email: `ops-db-cancel-${tag()}@vnx.si`, createdBy: owner.id, now: "2026-10-05T08:00:00.000Z" });
    await cancelOpsInviteStatement(db(), { id: item.id, now: "2026-10-05T09:00:00.000Z" }).run();
    expect(await cancelOpsInviteStatement(db(), { id: item.id, now: "2026-10-05T10:00:00.000Z" }).first()).toBeNull();
    expect(await findOpsInviteById(db(), item.id)).toMatchObject({ status: "cancelled", updatedAt: "2026-10-05T09:00:00.000Z" });
  });

  it("lists invitations by status, newest first", async () => {
    const owner = await ensureUser(`ops-db-own-${tag()}@vnx.si`);
    // Timestamps a century ahead keep these two at the top of "pending".
    const base = new Date(Date.now() + 100 * 365 * 24 * 3600 * 1000).toISOString();
    const older = await invite({ email: `ops-db-list1-${tag()}@vnx.si`, createdBy: owner.id, now: base });
    const newer = await invite({ email: `ops-db-list2-${tag()}@vnx.si`, createdBy: owner.id, now: plus(base, 60_000) });
    const pending = await listOpsInvites(db(), "pending");
    expect(pending.slice(0, 2).map((i) => i.id)).toEqual([newer.id, older.id]);
    expect((await listOpsInvites(db(), "cancelled")).map((i) => i.id)).not.toContain(newer.id);
  });
});

describe("db/ops-members: accepting an invitation (spec §3.3)", () => {
  it("creates the member and marks the invitation accepted in one batch", async () => {
    const owner = await ensureUser(`ops-db-own-${tag()}@vnx.si`);
    const user = await ensureUser(`ops-db-acc-${tag()}@vnx.si`);
    const item = await invite({ email: user.email, role: "content", createdBy: owner.id, now: "2026-10-05T08:00:00.000Z" });
    const now = "2026-10-06T08:00:00.000Z";
    const statements = acceptOpsInviteStatements(db(), { inviteId: item.id, userId: user.id, now });
    const results = await db().batch(statements);
    expect(results.map((r) => r.meta.changes)).toEqual([1, 1]);
    expect(await findOpsMember(db(), user.id)).toEqual({ userId: user.id, role: "content", grantedBy: owner.id, grantedAt: now, updatedAt: now });
    expect(await findOpsInviteById(db(), item.id)).toMatchObject({ status: "accepted", acceptedBy: user.id, updatedAt: now });
    const listed = await listOpsMembers(db());
    expect(listed.find((m) => m.userId === user.id)).toEqual({ userId: user.id, email: user.email, role: "content", grantedBy: owner.id, grantedAt: now, updatedAt: now });

    // A second accept of the same invitation changes nothing.
    const again = await db().batch(acceptOpsInviteStatements(db(), { inviteId: item.id, userId: user.id, now: "2026-10-07T08:00:00.000Z" }));
    expect(again.map((r) => r.meta.changes)).toEqual([0, 0]);
    expect((await findOpsMember(db(), user.id))?.updatedAt).toBe(now);
  });

  it("updates an existing member to the invited role", async () => {
    const owner = await ensureUser(`ops-db-own-${tag()}@vnx.si`);
    const user = await ensureUser(`ops-db-upd-${tag()}@vnx.si`);
    const first = await invite({ email: user.email, role: "viewer", createdBy: owner.id, now: "2026-10-05T08:00:00.000Z" });
    await db().batch(acceptOpsInviteStatements(db(), { inviteId: first.id, userId: user.id, now: "2026-10-05T09:00:00.000Z" }));
    const second = await invite({ email: user.email, role: "operator", createdBy: owner.id, now: "2026-10-06T08:00:00.000Z" });
    const now = "2026-10-06T09:00:00.000Z";
    await db().batch(acceptOpsInviteStatements(db(), { inviteId: second.id, userId: user.id, now }));
    expect(await findOpsMember(db(), user.id)).toEqual({ userId: user.id, role: "operator", grantedBy: owner.id, grantedAt: now, updatedAt: now });
    expect(await findOpsInviteById(db(), second.id)).toMatchObject({ status: "accepted", acceptedBy: user.id });
  });

  it("does nothing for another user's e-mail, an expired invitation or a cancelled one", async () => {
    const owner = await ensureUser(`ops-db-own-${tag()}@vnx.si`);
    const invited = await ensureUser(`ops-db-who-${tag()}@vnx.si`);
    const stranger = await ensureUser(`ops-db-other-${tag()}@vnx.si`);
    const createdAt = "2026-10-05T08:00:00.000Z";
    const item = await invite({ email: invited.email, createdBy: owner.id, now: createdAt });

    const wrongUser = await db().batch(acceptOpsInviteStatements(db(), { inviteId: item.id, userId: stranger.id, now: plus(createdAt, 60_000) }));
    expect(wrongUser.map((r) => r.meta.changes)).toEqual([0, 0]);
    expect(await findOpsMember(db(), stranger.id)).toBeNull();

    const atExpiry = await db().batch(acceptOpsInviteStatements(db(), { inviteId: item.id, userId: invited.id, now: plus(createdAt, INVITE_TTL_MS) }));
    expect(atExpiry.map((r) => r.meta.changes)).toEqual([0, 0]);
    expect(await findOpsMember(db(), invited.id)).toBeNull();
    expect((await findOpsInviteById(db(), item.id))?.status).toBe("pending");

    await cancelOpsInviteStatement(db(), { id: item.id, now: plus(createdAt, 120_000) }).run();
    const cancelled = await db().batch(acceptOpsInviteStatements(db(), { inviteId: item.id, userId: invited.id, now: plus(createdAt, 180_000) }));
    expect(cancelled.map((r) => r.meta.changes)).toEqual([0, 0]);
    expect(await findOpsMember(db(), invited.id)).toBeNull();
  });
});

describe("db/ops-members: members", () => {
  it("changes a role only from the expected one, and removes a member", async () => {
    const owner = await ensureUser(`ops-db-own-${tag()}@vnx.si`);
    const user = await ensureUser(`ops-db-role-${tag()}@vnx.si`);
    const item = await invite({ email: user.email, role: "viewer", createdBy: owner.id, now: "2026-10-05T08:00:00.000Z" });
    await db().batch(acceptOpsInviteStatements(db(), { inviteId: item.id, userId: user.id, now: "2026-10-05T09:00:00.000Z" }));

    const lost = await setOpsMemberRoleStatement(db(), { userId: user.id, from: "operator", to: "content", by: owner.id, now: "2026-10-05T10:00:00.000Z" }).first();
    expect(lost).toBeNull();
    const moved = await setOpsMemberRoleStatement(db(), { userId: user.id, from: "viewer", to: "content", by: owner.id, now: "2026-10-05T11:00:00.000Z" }).first();
    expect(moved).toMatchObject({ user_id: user.id });
    expect(await findOpsMember(db(), user.id)).toEqual({ userId: user.id, role: "content", grantedBy: owner.id, grantedAt: "2026-10-05T11:00:00.000Z", updatedAt: "2026-10-05T11:00:00.000Z" });

    expect(await deleteOpsMemberStatement(db(), { userId: user.id }).first()).toMatchObject({ user_id: user.id, role: "content" });
    expect(await findOpsMember(db(), user.id)).toBeNull();
    expect(await deleteOpsMemberStatement(db(), { userId: user.id }).first()).toBeNull();
  });
});

describe("db/ops-members: access read for the guard (spec §3.2, VNX-2502)", () => {
  it("reads the user's status, e-mail and member role in one query, for members and non-members alike", async () => {
    const owner = await ensureUser(`ops-db-acc-own-${tag()}@vnx.si`);
    const plain = await ensureUser(`ops-db-acc-plain-${tag()}@vnx.si`);
    const member = await ensureUser(`ops-db-acc-mem-${tag()}@vnx.si`);
    const item = await invite({ email: member.email, role: "content", createdBy: owner.id, now: "2026-10-05T08:00:00.000Z" });
    await db().batch(acceptOpsInviteStatements(db(), { inviteId: item.id, userId: member.id, now: "2026-10-05T09:00:00.000Z" }));

    expect(await findOpsAccess(db(), plain.id)).toEqual({ userStatus: "active", email: plain.email, memberRole: null });
    expect(await findOpsAccess(db(), member.id)).toEqual({ userStatus: "active", email: member.email, memberRole: "content" });
    expect(await findOpsAccess(db(), `no-such-user-${tag()}`)).toBeNull();
  });

  it("reports a suspended user's status and keeps their member role, so the resolver can refuse it", async () => {
    const owner = await ensureUser(`ops-db-acc-own2-${tag()}@vnx.si`);
    const member = await ensureUser(`ops-db-acc-susp-${tag()}@vnx.si`);
    const item = await invite({ email: member.email, role: "operator", createdBy: owner.id, now: "2026-10-05T08:00:00.000Z" });
    await db().batch(acceptOpsInviteStatements(db(), { inviteId: item.id, userId: member.id, now: "2026-10-05T09:00:00.000Z" }));
    await setUserStatusStatement(db(), { id: member.id, from: "active", to: "suspended", now: "2026-10-05T10:00:00.000Z" }).run();

    expect(await findOpsAccess(db(), member.id)).toEqual({ userStatus: "suspended", email: member.email, memberRole: "operator" });
  });

  it("sees a removed member at once (no caching)", async () => {
    const owner = await ensureUser(`ops-db-acc-own3-${tag()}@vnx.si`);
    const member = await ensureUser(`ops-db-acc-del-${tag()}@vnx.si`);
    const item = await invite({ email: member.email, role: "viewer", createdBy: owner.id, now: "2026-10-05T08:00:00.000Z" });
    await db().batch(acceptOpsInviteStatements(db(), { inviteId: item.id, userId: member.id, now: "2026-10-05T09:00:00.000Z" }));
    expect((await findOpsAccess(db(), member.id))?.memberRole).toBe("viewer");

    await deleteOpsMemberStatement(db(), { userId: member.id }).run();
    expect((await findOpsAccess(db(), member.id))?.memberRole).toBeNull();
  });
});

describe("db/ops-members: expiring invitations (spec §3.3)", () => {
  it("marks only overdue pending invitations expired and never touches members", async () => {
    const owner = await ensureUser(`ops-db-own-${tag()}@vnx.si`);
    const member = await ensureUser(`ops-db-exp-mem-${tag()}@vnx.si`);
    // Dates in 2020, before every other invitation in this file, so the sweep only reaches these rows.
    const createdAt = "2020-01-01T00:00:00.000Z";
    const accepted = await invite({ email: member.email, role: "viewer", createdBy: owner.id, now: createdAt });
    await db().batch(acceptOpsInviteStatements(db(), { inviteId: accepted.id, userId: member.id, now: plus(createdAt, 60_000) }));
    const overdue = await invite({ email: `ops-db-exp-old-${tag()}@vnx.si`, createdBy: owner.id, now: createdAt });
    const fresh = await invite({ email: `ops-db-exp-new-${tag()}@vnx.si`, createdBy: owner.id, now: plus(createdAt, 2 * 24 * 3600 * 1000) });
    const membersBefore = await memberCount();
    const memberBefore = await findOpsMember(db(), member.id);

    const now = plus(createdAt, INVITE_TTL_MS);
    const swept = await expireOpsInvitesStatement(db(), now).all<{ id: string; email: string; role: string }>();
    expect(swept.results.map((r) => r.id)).toContain(overdue.id);
    expect(swept.results.map((r) => r.id)).not.toContain(fresh.id);
    expect(swept.results.map((r) => r.id)).not.toContain(accepted.id);
    expect(swept.results.find((r) => r.id === overdue.id)).toMatchObject({ email: overdue.email, role: "operator" });

    expect(await findOpsInviteById(db(), overdue.id)).toMatchObject({ status: "expired", updatedAt: now });
    expect(await findOpsInviteById(db(), fresh.id)).toMatchObject({ status: "pending" });
    expect(await findOpsInviteById(db(), accepted.id)).toMatchObject({ status: "accepted" });
    expect(await memberCount()).toBe(membersBefore);
    expect(await findOpsMember(db(), member.id)).toEqual(memberBefore);
  });
});
