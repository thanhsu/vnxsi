import { describe, expect, it } from "vitest";
import { auditStatement } from "../../src/db/audit.ts";
import { createInquiryStatements, findInquiryById, listMessages } from "../../src/db/inquiries.ts";
import {
  endRequestBatch,
  findClientRequest,
  findRequestById,
  inviteBuildersBatch,
  listCandidates,
  listClientRequests,
  listRequestInvites,
  returnedRequest,
  setRequestStatusStatement,
} from "../../src/db/requests.ts";
import { deleteGhostUsers } from "../../src/db/users.ts";
import { ensureUser, inviteBuilders, makeBuilder, makeRequest, proposeOn } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const db = () => testEnv.DB;
const later = (iso: string, ms = 1000) => new Date(Date.parse(iso) + ms).toISOString();

async function builders(tag: string, n: number) {
  return Promise.all(Array.from({ length: n }, (_, i) => makeBuilder(`${tag}-${i}@vnx.si`, `${tag}-${i}`, "approved")));
}

describe("db/requests (VNX-0601)", () => {
  it("creates submitted and pending requests; submitted_at only for submitted", async () => {
    const { request } = await makeRequest({ tag: "rq-new", languages: ["vi", "zh"] });
    expect(request).toMatchObject({ status: "submitted", clientName: "Minh Tran", languages: ["vi", "zh"], submittedAt: request.createdAt, matchedAt: null });
    const pending = await makeRequest({ tag: "rq-pend", status: "pending_verification" });
    expect(pending.request.submittedAt).toBeNull();
  });

  it("hides removed requests from their client and other clients' requests entirely", async () => {
    const { client, request } = await makeRequest({ tag: "rq-vis" });
    const other = await makeRequest({ tag: "rq-vis2" });
    expect((await findClientRequest(db(), client.id, request.id))?.id).toBe(request.id);
    expect(await findClientRequest(db(), client.id, other.request.id)).toBeNull();
    await db().prepare("UPDATE requests SET status = 'removed' WHERE id = ?1").bind(request.id).run();
    expect(await findClientRequest(db(), client.id, request.id)).toBeNull();
    expect(await listClientRequests(db(), client.id)).toEqual([]);
  });

  it("invites up to 5 active builders and moves the request to matching once", async () => {
    const { request } = await makeRequest({ tag: "rq-cap" });
    const six = await builders("rq-cap-b", 6);
    const admin = await ensureUser("owner@vnx.si");
    const now = new Date().toISOString();
    const batch = inviteBuildersBatch(db(), { requestId: request.id, builderIds: six.map((b) => b.userId), invitedBy: admin.id, now });
    const outcome = batch.read(await db().batch(batch.statements));
    expect(outcome.request?.status).toBe("matching");
    expect(outcome.request?.matchedAt).toBe(now);
    expect(outcome.invited.map((i) => i.builderId)).toEqual(six.slice(0, 5).map((b) => b.userId));
    expect(await listRequestInvites(db(), request.id)).toHaveLength(5);
  });

  it("frees a slot when an invitation is declined, never re-invites, keeps matched_at", async () => {
    const { request } = await makeRequest({ tag: "rq-slot" });
    const bs = await builders("rq-slot-b", 6);
    const first = await inviteBuilders(request, bs.slice(0, 5));
    await db().prepare("UPDATE request_invites SET status = 'declined' WHERE id = ?1").bind(first[0]!.id).run();
    const admin = await ensureUser("owner@vnx.si");
    const now = later(new Date().toISOString());
    const again = inviteBuildersBatch(db(), { requestId: request.id, builderIds: [bs[0]!.userId, bs[5]!.userId], invitedBy: admin.id, now });
    const outcome = again.read(await db().batch(again.statements));
    expect(outcome.invited.map((i) => i.builderId)).toEqual([bs[5]!.userId]);
    expect(outcome.request?.matchedAt).toBe((await findRequestById(db(), request.id))?.matchedAt);
    expect(outcome.request?.matchedAt).not.toBe(now);
  });

  it("never invites the client, a suspended builder, or into a closed request; then nothing changes", async () => {
    const { client, request } = await makeRequest({ tag: "rq-bad" });
    const self = await makeBuilder(client.email, "rq-bad-self", "approved");
    const suspended = await makeBuilder("rq-bad-s@vnx.si", "rq-bad-s", "suspended");
    const admin = await ensureUser("owner@vnx.si");
    const batch = inviteBuildersBatch(db(), { requestId: request.id, builderIds: [self.userId, suspended.userId], invitedBy: admin.id, now: new Date().toISOString() });
    const outcome = batch.read(await db().batch(batch.statements));
    expect(outcome).toEqual({ request: null, invited: [] });
    expect((await findRequestById(db(), request.id))?.status).toBe("submitted");

    const ok = await builders("rq-bad-ok", 1);
    await db().prepare("UPDATE requests SET status = 'closed' WHERE id = ?1").bind(request.id).run();
    const closed = inviteBuildersBatch(db(), { requestId: request.id, builderIds: [ok[0]!.userId], invitedBy: admin.id, now: new Date().toISOString() });
    expect(closed.read(await db().batch(closed.statements))).toEqual({ request: null, invited: [] });
    expect(await listRequestInvites(db(), request.id)).toEqual([]);
  });

  it("ends a request: invited -> expired, proposed -> not_selected, with an audit row, all or nothing", async () => {
    const { request } = await makeRequest({ tag: "rq-end" });
    const bs = await builders("rq-end-b", 3);
    const [a, b, c] = await inviteBuilders(request, bs);
    await proposeOn(a!);
    await db().prepare("UPDATE request_invites SET status = 'declined' WHERE id = ?1").bind(c!.id).run();
    const current = (await findRequestById(db(), request.id))!;
    const now = later(current.updatedAt);
    const end = endRequestBatch(db(), { id: request.id, from: "matching", to: "closed", now });
    const results = await db().batch([...end.statements, auditStatement(db(), { actorUserId: null, action: "request.close", entity: "request", entityId: request.id, now }, { requestId: request.id, status: "closed", updatedAt: now })]);
    const outcome = end.read(results);
    expect(outcome.request).toMatchObject({ status: "closed", closedAt: now });
    expect(outcome.notSelected).toEqual([a!.id]);
    expect(outcome.expired).toEqual([b!.id]);
    const invites = await listRequestInvites(db(), request.id);
    expect(invites.map((x) => [x.invite.id, x.invite.status])).toEqual([
      [a!.id, "not_selected"],
      [b!.id, "expired"],
      [c!.id, "declined"],
    ]);
    const audit = await db().prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'request.close' AND entity_id = ?1").bind(request.id).first<{ n: number }>();
    expect(audit?.n).toBe(1);

    // Lost compare-and-set (already closed): nothing else is written.
    const again = endRequestBatch(db(), { id: request.id, from: "matching", to: "expired", now: later(now) });
    const second = again.read(await db().batch([...again.statements, auditStatement(db(), { actorUserId: null, action: "request.expire", entity: "request", entityId: request.id, now: later(now) }, { requestId: request.id, status: "expired", updatedAt: later(now) })]));
    expect(second).toEqual({ request: null, notSelected: [], expired: [] });
    const expireAudit = await db().prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'request.expire' AND entity_id = ?1").bind(request.id).first<{ n: number }>();
    expect(expireAudit?.n).toBe(0);
  });

  it("creates a guarded inquiry only when the batch selected that invitation", async () => {
    const { client, request } = await makeRequest({ tag: "rq-sel" });
    const [builder] = await builders("rq-sel-b", 1);
    const [invite] = await inviteBuilders(request, [builder!]);
    await proposeOn(invite!);
    const current = (await findRequestById(db(), request.id))!;
    const now = later(current.updatedAt);
    const inquiry = createInquiryStatements(
      db(),
      { clientUserId: client.id, clientName: "Minh Tran", builderId: builder!.userId, productId: null, requestId: request.id, type: "request", message: "Request + proposal", budgetBand: "2k-10k", deadline: null, status: "open", locale: "en", now },
      { requestId: request.id, inviteId: invite!.id, updatedAt: now },
    );
    // Wrong guard (no compare-and-set in this batch): nothing is written.
    await db().batch(inquiry.statements);
    expect(await findInquiryById(db(), inquiry.id)).toBeNull();

    const moved = await db().batch([setRequestStatusStatement(db(), { id: request.id, from: "matching", to: "builder_selected", now, selectedInviteId: invite!.id }), ...inquiry.statements]);
    expect(returnedRequest(moved[0])?.selectedInviteId).toBe(invite!.id);
    const created = await findInquiryById(db(), inquiry.id);
    expect(created).toMatchObject({ type: "request", requestId: request.id, status: "open", openedAt: now });
    expect((await listMessages(db(), inquiry.id)).map((m) => m.id)).toEqual([inquiry.firstMessageId]);
  });

  async function selectBatch(tag: string, mutate: (ctx: { request: { id: string }; invite: { id: string }; other: { id: string }; builderId: string }) => Promise<void>) {
    const { client, request } = await makeRequest({ tag });
    const other = await makeRequest({ tag: `${tag}-o` });
    const [builder] = await builders(`${tag}-b`, 1);
    const [invite] = await inviteBuilders(request, [builder!]);
    const [otherBuilder] = await builders(`${tag}-ob`, 1);
    const [otherInvite] = await inviteBuilders(other.request, [otherBuilder!]);
    await proposeOn(invite!);
    await proposeOn(otherInvite!);
    await mutate({ request, invite: invite!, other: otherInvite!, builderId: builder!.userId });
    const before = (await findRequestById(db(), request.id))!;
    const now = later(before.updatedAt);
    const picked = (await db().prepare("SELECT selected_invite_id FROM requests WHERE id = ?1").bind(request.id).first<{ selected_invite_id: string | null }>())!;
    expect(picked.selected_invite_id).toBeNull();
    return { client, request, invite: invite!, otherInvite: otherInvite!, builder: builder!, before, now };
  }

  it("writes nothing when the selected builder was suspended after proposing", async () => {
    const ctx = await selectBatch("rq-susp", async ({ builderId }) => {
      await db().prepare("UPDATE builders SET status = 'suspended' WHERE user_id = ?1").bind(builderId).run();
    });
    const inquiry = createInquiryStatements(db(), { clientUserId: ctx.client.id, clientName: "Minh Tran", builderId: ctx.builder.userId, productId: null, requestId: ctx.request.id, type: "request", message: "m", budgetBand: "2k-10k", deadline: null, status: "open", locale: "en", now: ctx.now }, { requestId: ctx.request.id, inviteId: ctx.invite.id, updatedAt: ctx.now });
    const end = endRequestBatch(db(), { id: ctx.request.id, from: "matching", to: "builder_selected", now: ctx.now, selectedInviteId: ctx.invite.id }, inquiry.statements);
    const audit = auditStatement(db(), { actorUserId: null, action: "request.select", entity: "request", entityId: ctx.request.id, now: ctx.now }, { requestId: ctx.request.id, status: "builder_selected", updatedAt: ctx.now });
    expect(end.read(await db().batch([...end.statements, audit]))).toEqual({ request: null, notSelected: [], expired: [] });
    expect(await findRequestById(db(), ctx.request.id)).toEqual(ctx.before);
    expect((await listRequestInvites(db(), ctx.request.id))[0]?.invite.status).toBe("proposed");
    expect(await findInquiryById(db(), inquiry.id)).toBeNull();
    const n = await db().prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'request.select' AND entity_id = ?1").bind(ctx.request.id).first<{ n: number }>();
    expect(n?.n).toBe(0);
  });

  it("writes nothing when the selected invitation belongs to another request", async () => {
    const ctx = await selectBatch("rq-xreq", async () => {});
    const inquiry = createInquiryStatements(db(), { clientUserId: ctx.client.id, clientName: "Minh Tran", builderId: ctx.builder.userId, productId: null, requestId: ctx.request.id, type: "request", message: "m", budgetBand: "2k-10k", deadline: null, status: "open", locale: "en", now: ctx.now }, { requestId: ctx.request.id, inviteId: ctx.otherInvite.id, updatedAt: ctx.now });
    const end = endRequestBatch(db(), { id: ctx.request.id, from: "matching", to: "builder_selected", now: ctx.now, selectedInviteId: ctx.otherInvite.id }, inquiry.statements);
    const audit = auditStatement(db(), { actorUserId: null, action: "request.select", entity: "request", entityId: ctx.request.id, now: ctx.now }, { requestId: ctx.request.id, status: "builder_selected", updatedAt: ctx.now });
    expect(end.read(await db().batch([...end.statements, audit]))).toEqual({ request: null, notSelected: [], expired: [] });
    expect(await findRequestById(db(), ctx.request.id)).toEqual(ctx.before);
    expect((await listRequestInvites(db(), ctx.request.id))[0]?.invite.status).toBe("proposed");
    expect((await listRequestInvites(db(), ctx.otherInvite.requestId))[0]?.invite.status).toBe("proposed");
    expect(await findInquiryById(db(), inquiry.id)).toBeNull();
    const n = await db().prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'request.select' AND entity_id = ?1").bind(ctx.request.id).first<{ n: number }>();
    expect(n?.n).toBe(0);
  });

  it("keeps an implicit account that has a request, and deletes one that has nothing", async () => {
    const old = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
    const { client } = await makeRequest({ tag: "rq-ghost", status: "pending_verification", now: old });
    await db().prepare("UPDATE users SET created_at = ?2 WHERE id = ?1").bind(client.id, old).run();
    const bare = await ensureUser("rq-ghost-bare@vnx.si");
    await db().prepare("UPDATE users SET created_at = ?2 WHERE id = ?1").bind(bare.id, old).run();
    await deleteGhostUsers(db(), new Date(Date.now() - 48 * 3600 * 1000).toISOString());
    expect(await db().prepare("SELECT id FROM users WHERE id = ?1").bind(client.id).first()).not.toBeNull();
    expect(await db().prepare("SELECT id FROM users WHERE id = ?1").bind(bare.id).first()).toBeNull();
  });

  it("does not move the request, nor audit, when this batch invited nobody, even if another batch invited at the same instant", async () => {
    const { request } = await makeRequest({ tag: "rq-same" });
    const [a, b] = await builders("rq-same-b", 2);
    const admin = await ensureUser("owner@vnx.si");
    const now = new Date().toISOString();
    await inviteBuilders(request, [a!], now);
    const audits = async () => ((await db().prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'request.invite' AND entity_id = ?1").bind(request.id).first<{ n: number }>())?.n ?? 0);
    const run = async (builderId: string) => {
      const batch = inviteBuildersBatch(db(), { requestId: request.id, builderIds: [builderId], invitedBy: admin.id, now });
      const results = await db().batch([...batch.statements, auditStatement(db(), { actorUserId: admin.id, action: "request.invite", entity: "request", entityId: request.id, now }, { requestId: request.id, inviteIds: batch.inviteIds })]);
      return batch.read(results);
    };
    expect(await run(a!.userId)).toEqual({ request: null, invited: [] }); // duplicate: inserts nothing
    expect(await audits()).toBe(0);
    expect((await run(b!.userId)).invited).toHaveLength(1);
    expect(await audits()).toBe(1);
  });

  it("lists only eligible candidates; only lapsed expired invitations count against them (spec §8.10)", async () => {
    const { client, request } = await makeRequest({ tag: "rq-pen" });
    const [b, taken] = await builders("rq-pen-b", 2);
    const day = 24 * 3600 * 1000;
    const t0 = Date.now() - 20 * day;
    const lapsed = await makeRequest({ tag: "rq-pen-l" });
    const early = await makeRequest({ tag: "rq-pen-e" });
    const [lapsedInvite] = await inviteBuilders(lapsed.request, [b!], new Date(t0).toISOString());
    const [earlyInvite] = await inviteBuilders(early.request, [b!], new Date(t0).toISOString());
    const expire = (id: string, after: number) => db().prepare("UPDATE request_invites SET status = 'expired', updated_at = ?2 WHERE id = ?1").bind(id, new Date(t0 + after * day).toISOString()).run();
    await expire(lapsedInvite!.id, 8); // no answer in 7 days
    await expire(earlyInvite!.id, 1); // the request ended early
    await inviteBuilders(request, [taken!]);
    const self = await makeBuilder(client.email, "rq-pen-self", "approved");
    const closed = await makeBuilder("rq-pen-cl@vnx.si", "rq-pen-cl", "approved", { availability: "closed" });
    const pending = await makeBuilder("rq-pen-pe@vnx.si", "rq-pen-pe", "pending");
    const suspended = await makeBuilder("rq-pen-su@vnx.si", "rq-pen-su", "suspended");
    const locked = await makeBuilder("rq-pen-lo@vnx.si", "rq-pen-lo", "approved");
    await db().prepare("UPDATE users SET status = 'suspended' WHERE id = ?1").bind(locked.userId).run();
    const since = new Date(Date.now() - 60 * day).toISOString();
    const found = await listCandidates(db(), request, since);
    expect(found.find((x) => x.userId === b!.userId)?.expiredInvites).toBe(1);
    for (const gone of [taken!, self, closed, pending, suspended, locked]) expect(found.map((x) => x.userId)).not.toContain(gone.userId);
    const later = new Date(Date.now() + 1000).toISOString();
    expect((await listCandidates(db(), request, later)).find((x) => x.userId === b!.userId)?.expiredInvites).toBe(0);
  });
});
