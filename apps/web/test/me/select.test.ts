import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { findInquiryById, listMessages, listUnnotifiedMessages } from "../../src/db/inquiries.ts";
import { findRequestById, listRequestInvites } from "../../src/db/requests.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import type { Bindings } from "../../src/env.ts";
import { runDaily } from "../../src/jobs/daily.ts";
import { inviteBuilders, makeBuilder, makeRequest, proposeOn, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const app = () => createApp();
const get = (path: string, cookie: string) => app().request(getReq(path, cookie), undefined, testEnv);
const post = (path: string, cookie: string, fields: Record<string, string> = {}, env: Bindings = testEnv) => app().request(formPost(path, fields, { cookie }), undefined, env);
const noMail = { ...testEnv, MAIL_DRIVER: undefined } as Bindings; // UnconfiguredMailer: every send fails
const count = async (sql: string, ...args: string[]) => (await testEnv.DB.prepare(sql).bind(...args).first<{ n: number }>())?.n ?? 0;
const inquiries = (requestId: string) => count("SELECT COUNT(*) AS n FROM inquiries WHERE request_id = ?1", requestId);
const selectAudits = (requestId: string) => count("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'request.select' AND entity_id = ?1", requestId);
const inviteOf = async (requestId: string, inviteId: string) => (await listRequestInvites(testEnv.DB, requestId)).find((x) => x.invite.id === inviteId)!.invite;

/** A matching request with three invitations: A and B proposed, C still invited. */
async function threeWay(tag: string, clientLocale?: string) {
  const { client, request } = await makeRequest({ tag, clientLocale });
  const [a, b, c] = await Promise.all(["a", "b", "x"].map((k) => makeBuilder(`${tag}-${k}@vnx.si`, `${tag}-${k}`, "approved", { name: `${tag} ${k.toUpperCase()}` })));
  const [ia, ib, ic] = await inviteBuilders(request, [a!, b!, c!]);
  await proposeOn(ia!);
  await proposeOn(ib!);
  const { cookie } = await signIn(client.email);
  return { client, request, a: a!, b: b!, c: c!, ia: ia!, ib: ib!, ic: ic!, cookie };
}

/** Nothing was written: request still matching, no inquiry, no select audit, no e-mail. */
async function expectUntouched(requestId: string) {
  expect((await findRequestById(testEnv.DB, requestId))?.status).toBe("matching");
  expect(await inquiries(requestId)).toBe(0);
  expect(await selectAudits(requestId)).toBe(0);
  expect((await listRequestInvites(testEnv.DB, requestId)).map((x) => x.invite.status).sort()).toEqual(["invited", "proposed", "proposed"]);
  expect(outbox).toEqual([]);
}

describe("choosing a proposal (spec §5.7 step 4)", { timeout: 30_000 }, () => {
  beforeEach(() => clearOutbox());

  it("shows proposals with a Choose button only for proposed ones of public builders", async () => {
    const { request, ia, ib, ic, b, cookie } = await threeWay("ms-show");
    await testEnv.DB.prepare("UPDATE builders SET status = 'suspended' WHERE user_id = ?1").bind(b.userId).run();
    const html = await (await get(`/me/requests/${request.id}`, cookie)).text();
    expect(html).toContain("From ms-show A");
    expect(html).toContain("$4,500");
    expect(html).toContain("Next.js with a booking calendar.");
    expect(html).toContain(`name="invite" value="${ia.id}"`);
    expect(html).not.toContain(`value="${ib.id}"`);
    expect(html).toContain("This builder is not available any more.");
    expect(html).not.toContain(`value="${ic.id}"`); // still invited: no proposal to show
  });

  it("selects A: request builder_selected, invitations settle, an inquiry opens with request + proposal, e-mails go out", async () => {
    const { client, request, a, ia, ib, ic, cookie } = await threeWay("ms-pick");
    const res = await post(`/vi/me/requests/${request.id}/select`, cookie, { invite: ia.id });
    expect(res.status).toBe(303);
    const after = await findRequestById(testEnv.DB, request.id);
    expect(after).toMatchObject({ status: "builder_selected", selectedInviteId: ia.id });
    expect(after?.closedAt).not.toBeNull();
    const chosen = await inviteOf(request.id, ia.id);
    expect(chosen.status).toBe("selected");
    expect((await inviteOf(request.id, ib.id)).status).toBe("not_selected");
    expect((await inviteOf(request.id, ic.id)).status).toBe("expired");
    const inquiryId = chosen.inquiryId!;
    expect(res.headers.get("location")).toBe(`/vi/me/inquiries/${inquiryId}`);
    expect(await findInquiryById(testEnv.DB, inquiryId)).toMatchObject({ type: "request", requestId: request.id, clientUserId: client.id, builderId: a.userId, status: "open", productId: null, clientName: "Minh Tran" });
    const [first] = await listMessages(testEnv.DB, inquiryId);
    expect(first?.body).toContain(`Request: ${request.title}`);
    expect(first?.body).toContain(request.description);
    expect(first?.body).toContain("Next.js with a booking calendar.");
    expect(first?.body).toContain("Price: $4,500");
    expect(first?.body).toContain("Timeline: 30 days");
    expect(first?.body).not.toContain(client.email);
    expect(first?.notifiedAt).not.toBeNull();
    const toA = outbox.filter((m) => m.to === "ms-pick-a@vnx.si");
    expect(toA).toHaveLength(1);
    expect(toA[0]?.subject).toBe("Minh Tran chose your proposal");
    expect(toA[0]?.text).toContain(`https://vnx.si/hub/inquiries/${inquiryId}`);
    expect(toA[0]?.text).toContain("Next.js with a booking calendar.");
    expect(outbox.find((m) => m.to === "ms-pick-b@vnx.si")?.subject).toBe(`Update on your proposal: ${request.title}`);
    expect(outbox.find((m) => m.to === "ms-pick-x@vnx.si")?.subject).toBe(`Invitation ended: ${request.title}`);
    expect(outbox.some((m) => m.to === client.email)).toBe(false);
    for (const m of outbox) expect(`${m.subject}${m.text}${m.html}`).not.toContain(client.email);
    const audit = await testEnv.DB.prepare("SELECT data FROM audit_log WHERE action = 'request.select' AND entity_id = ?1").bind(request.id).first<{ data: string }>();
    expect(JSON.parse(audit!.data)).toEqual({ inviteId: ia.id, inquiryId });
  });

  it("labels the first message in the request's language", async () => {
    const { request, ia, cookie } = await threeWay("ms-vi", "vi");
    await post(`/vi/me/requests/${request.id}/select`, cookie, { invite: ia.id });
    const inquiryId = (await inviteOf(request.id, ia.id)).inquiryId!;
    const [first] = await listMessages(testEnv.DB, inquiryId);
    expect(first?.body).toContain(`Nhu cầu: ${request.title}`);
    expect(first?.body).toContain("Đề xuất");
  });

  // Review Focus 4: bấm "Chọn" hai lần.
  it("is single-shot: a second choice is 409 with no second inquiry or e-mail; closing afterwards is 409 too", async () => {
    const { request, ia, ib, cookie } = await threeWay("ms-twice");
    expect((await post(`/me/requests/${request.id}/select`, cookie, { invite: ia.id })).status).toBe(303);
    clearOutbox();
    expect((await post(`/me/requests/${request.id}/select`, cookie, { invite: ib.id })).status).toBe(409);
    expect((await post(`/me/requests/${request.id}/select`, cookie, { invite: ia.id })).status).toBe(409);
    expect((await post(`/me/requests/${request.id}/close`, cookie)).status).toBe(409);
    expect(await inquiries(request.id)).toBe(1);
    expect(await selectAudits(request.id)).toBe(1);
    expect(outbox).toEqual([]);
    expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("builder_selected");
  });

  it("two simultaneous clicks make exactly one inquiry", async () => {
    const { request, ia, cookie } = await threeWay("ms-race");
    const results = await Promise.all([post(`/me/requests/${request.id}/select`, cookie, { invite: ia.id }), post(`/me/requests/${request.id}/select`, cookie, { invite: ia.id })]);
    expect(results.map((r) => r.status).sort()).toEqual([303, 409]);
    expect(await inquiries(request.id)).toBe(1);
    expect(await selectAudits(request.id)).toBe(1);
    expect(outbox.filter((m) => m.to === "ms-race-a@vnx.si")).toHaveLength(1);
  });

  // Review Focus 4: builder bị khóa sau khi gửi đề xuất.
  it("409s a proposal of a builder suspended after proposing, and writes nothing", async () => {
    const { request, a, ia, cookie } = await threeWay("ms-susp");
    await testEnv.DB.prepare("UPDATE builders SET status = 'suspended' WHERE user_id = ?1").bind(a.userId).run();
    expect((await post(`/me/requests/${request.id}/select`, cookie, { invite: ia.id })).status).toBe(409);
    await expectUntouched(request.id);
  });

  // Review Focus 2.
  it("404s another request's invitation and another client's request; nothing is written", async () => {
    const mine = await threeWay("ms-cross");
    const other = await threeWay("ms-cross2");
    clearOutbox();
    expect((await post(`/me/requests/${mine.request.id}/select`, mine.cookie, { invite: other.ia.id })).status).toBe(404);
    expect((await post(`/me/requests/${mine.request.id}/select`, mine.cookie, { invite: "no-such-invite" })).status).toBe(404);
    expect((await post(`/me/requests/${other.request.id}/select`, mine.cookie, { invite: other.ia.id })).status).toBe(404);
    await expectUntouched(mine.request.id);
    await expectUntouched(other.request.id);
  });

  it("409s an invitation that has no proposal yet, and a request that was closed", async () => {
    const { request, ic, ia, cookie } = await threeWay("ms-state");
    expect((await post(`/me/requests/${request.id}/select`, cookie, { invite: ic.id })).status).toBe(409);
    await expectUntouched(request.id);
    expect((await post(`/me/requests/${request.id}/close`, cookie)).status).toBe(303);
    clearOutbox();
    expect((await post(`/me/requests/${request.id}/select`, cookie, { invite: ia.id })).status).toBe(409);
    expect(await inquiries(request.id)).toBe(0);
    expect(outbox).toEqual([]);
  });

  it("keeps the choice when the e-mail fails: the first message is unsent and the M5 daily job delivers it", async () => {
    const { request, ia, cookie } = await threeWay("ms-retry");
    expect((await post(`/me/requests/${request.id}/select`, cookie, { invite: ia.id }, noMail)).status).toBe(303);
    const inquiryId = (await inviteOf(request.id, ia.id)).inquiryId!;
    const [first] = await listMessages(testEnv.DB, inquiryId);
    expect(first?.notifiedAt).toBeNull();
    expect((await listUnnotifiedMessages(testEnv.DB)).some((m) => m.id === first!.id)).toBe(true);
    await runDaily(testEnv, new Date()); // the M5 resend step
    expect((await listMessages(testEnv.DB, inquiryId))[0]?.notifiedAt).not.toBeNull();
    expect(outbox.find((m) => m.to === "ms-retry-a@vnx.si")?.subject).toBe("Minh Tran chose your proposal");
  });

  it("shows the request title wherever the inquiry names its subject, for both sides, the admin and the reminder", async () => {
    const { request, ia, cookie } = await threeWay("ms-thread");
    await post(`/me/requests/${request.id}/select`, cookie, { invite: ia.id });
    const inquiryId = (await inviteOf(request.id, ia.id)).inquiryId!;
    const builderCookie = (await signIn("ms-thread-a@vnx.si")).cookie;
    const adminCookie = (await signIn("owner@vnx.si", { admin: true })).cookie;
    const about = `<dd>${request.title}</dd>`;
    for (const html of [await (await get(`/me/inquiries/${inquiryId}`, cookie)).text(), await (await get(`/hub/inquiries/${inquiryId}`, builderCookie)).text()]) {
      expect(html).toContain(about);
      expect(html).not.toMatch(/<dd>\s*<a href="\/b\/ms-thread-a"/); // the "About" cell no longer falls back to the builder
    }
    expect(await (await get("/hub/inquiries", builderCookie)).text()).toContain(` · ${request.title}`);
    expect(await (await get("/admin/inquiries", adminCookie)).text()).toContain(`@ms-thread-a · ${request.title}`);
    clearOutbox();
    await runDaily(testEnv, new Date(Date.now() + 4 * 24 * 3600 * 1000));
    const reminder = outbox.find((m) => m.to === "ms-thread-a@vnx.si" && m.subject.includes("waiting for your reply"));
    expect(reminder?.text).toContain(request.title);
  });

  // Nghĩa vụ 4: admin gỡ request đã chọn không làm mất Inquiry.
  it("keeps the inquiry when an admin removes the builder_selected request", async () => {
    const { client, request, ia, cookie } = await threeWay("ms-removed");
    await post(`/me/requests/${request.id}/select`, cookie, { invite: ia.id });
    const inquiryId = (await inviteOf(request.id, ia.id)).inquiryId!;
    clearOutbox();
    const adminCookie = (await signIn("owner@vnx.si", { admin: true })).cookie;
    expect((await post(`/admin/requests/${request.id}/remove`, adminCookie)).status).toBe(303);
    expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("removed");
    expect(await findInquiryById(testEnv.DB, inquiryId)).toMatchObject({ status: "open", requestId: request.id, clientUserId: client.id });
    expect(await listMessages(testEnv.DB, inquiryId)).toHaveLength(1);
    expect((await inviteOf(request.id, ia.id)).status).toBe("selected");
    expect((await get(`/me/requests/${request.id}`, cookie)).status).toBe(404);
    expect((await get(`/me/inquiries/${inquiryId}`, cookie)).status).toBe(200);
    const builderCookie = (await signIn("ms-removed-a@vnx.si")).cookie;
    const thread = await get(`/hub/inquiries/${inquiryId}`, builderCookie);
    expect(thread.status).toBe(200);
    expect(await thread.text()).toContain(request.title);
    expect(outbox).toEqual([]); // the chosen builder is told nothing more, the other invitations had settled already
  });
});
