import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { findInquiryById } from "../../src/db/inquiries.ts";
import { listRequestInvites } from "../../src/db/requests.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import { runDaily } from "../../src/jobs/daily.ts";
import { notifyInvited, notifyInviteReminder } from "../../src/notify/request.ts";
import { inviteBuilders, makeBuilder, makeRequest, proposeOn, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const app = () => createApp();
const get = (path: string, cookie: string) => app().request(getReq(path, cookie), undefined, testEnv);
const post = (path: string, cookie: string, fields: Record<string, string> = {}) => app().request(formPost(path, fields, { cookie }), undefined, testEnv);

describe("a client who types their e-mail as their name (Owner 2026-10-04, Review Focus 1)", { timeout: 30_000 }, () => {
  beforeEach(() => clearOutbox());

  it("never reaches the builder: not in subjects, texts, html, inbox or thread, from invitation to reminder", async () => {
    const { client, request } = await makeRequest({ tag: "mk" });
    await testEnv.DB.prepare("UPDATE requests SET client_name = ?2 WHERE id = ?1").bind(request.id, client.email).run();
    const builder = await makeBuilder("mk-a@vnx.si", "mk-a", "approved", { name: "Mk A" });
    const [invite] = await inviteBuilders(request, [builder]);
    await notifyInvited(testEnv, [invite!.id]);
    await notifyInviteReminder(testEnv, invite!.id);
    await proposeOn(invite!);

    const clientCookie = (await signIn(client.email)).cookie;
    const builderCookie = (await signIn("mk-a@vnx.si")).cookie;
    expect((await post(`/me/requests/${request.id}/select`, clientCookie, { invite: invite!.id })).status).toBe(303);
    const inquiryId = (await listRequestInvites(testEnv.DB, request.id))[0]!.invite.inquiryId!;
    expect((await findInquiryById(testEnv.DB, inquiryId))?.clientName).toBe(client.email); // stored as typed: the mask is applied on the way out
    expect((await post(`/me/inquiries/${inquiryId}/reply`, clientCookie, { body: "Can you start Monday?" })).status).toBe(303);
    await runDaily(testEnv, new Date(Date.now() + 4 * 24 * 3600 * 1000)); // inquiry reminder for the unanswered thread

    const toBuilder = outbox.filter((m) => m.to === "mk-a@vnx.si");
    expect(toBuilder.length).toBeGreaterThanOrEqual(5); // invited, reminder, chosen, new message, inquiry reminder
    for (const m of toBuilder) for (const part of [m.subject, m.text, m.html]) expect(part, m.subject).not.toContain(client.email);
    expect(toBuilder.find((m) => m.subject.includes("chose your proposal"))?.subject).toBe("••• chose your proposal");
    const pages = [await (await get("/hub/inquiries", builderCookie)).text(), await (await get(`/hub/inquiries/${inquiryId}`, builderCookie)).text()];
    for (const html of pages) expect(html).not.toContain(client.email);
    expect(pages[0]).toContain("From •••");
    // The client still sees what was typed.
    expect(await (await get(`/me/inquiries/${inquiryId}`, clientCookie)).text()).toContain("To Mk A");
  });
});
