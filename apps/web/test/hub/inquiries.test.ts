import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { findInquiryById, listMessages } from "../../src/db/inquiries.ts";
import { setBuilderStatus } from "../../src/db/builders.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import { makeInquiry, signIn } from "../fixtures.ts";
import { expectErrorSummary, formPost, getReq, testEnv } from "../helpers.ts";

const app = () => createApp();
const get = (path: string, cookie: string) => app().request(getReq(path, cookie), undefined, testEnv);
const post = (path: string, fields: Record<string, string>, cookie: string) => app().request(formPost(path, fields, { cookie }), undefined, testEnv);

describe("Hub inbox (spec §5.3)", () => {
  beforeEach(() => clearOutbox());

  it("lists the builder's inquiries with the client's name but never their e-mail", async () => {
    const { builder, client, inquiry } = await makeInquiry({ tag: "hi-list", status: "open" });
    const { cookie } = await signIn(`hi-list-b@vnx.si`);
    const list = await (await get("/hub/inquiries", cookie)).text();
    expect(list).toContain("From Minh Tran");
    expect(list).toContain("hi-list product");
    expect(list).toContain(`href="/hub/inquiries/${inquiry.id}"`);
    expect(list).toContain("Open");
    const thread = await (await get(`/hub/inquiries/${inquiry.id}`, cookie)).text();
    for (const text of ["Minh Tran", inquiry.message, "$500 – $2,000", "Buy"]) expect(thread, text).toContain(text);
    expect(list + thread).not.toContain(client.email);
    expect(builder.userId).toBeTruthy();
  });

  it("shows the open count on the overview and an Inquiries tab", async () => {
    await makeInquiry({ tag: "hi-count", status: "open" });
    const { cookie } = await signIn("hi-count-b@vnx.si");
    const html = await (await get("/hub", cookie)).text();
    expect(html).toContain("Open inquiries: 1");
    expect(html).toContain('href="/hub/inquiries"');
  });

  it("hides pending, removed and other builders' inquiries", async () => {
    const pending = await makeInquiry({ tag: "hi-hide1", status: "pending_verification" });
    const removed = await makeInquiry({ tag: "hi-hide2", status: "removed" });
    const other = await makeInquiry({ tag: "hi-hide3", status: "open" });
    const { cookie } = await signIn("hi-hide1-b@vnx.si");
    expect((await get(`/hub/inquiries/${pending.inquiry.id}`, cookie)).status).toBe(404);
    expect((await get(`/hub/inquiries/${other.inquiry.id}`, cookie)).status).toBe(404);
    expect((await post(`/hub/inquiries/${other.inquiry.id}/reply`, { body: "Hi" }, cookie)).status).toBe(404);
    const removedCookie = (await signIn("hi-hide2-b@vnx.si")).cookie;
    expect((await get(`/hub/inquiries/${removed.inquiry.id}`, removedCookie)).status).toBe(404);
    expect(await (await get("/hub/inquiries", cookie)).text()).toContain("No inquiries yet.");
  });

  it("replies: open becomes answered, the client gets an e-mail", async () => {
    const { inquiry, client } = await makeInquiry({ tag: "hi-reply", status: "open" });
    const { cookie } = await signIn("hi-reply-b@vnx.si");
    const res = await post(`/vi/hub/inquiries/${inquiry.id}/reply`, { body: "Yes, we can do it.\r\nNext week?" }, cookie);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`/vi/hub/inquiries/${inquiry.id}`);
    expect((await findInquiryById(testEnv.DB, inquiry.id))?.status).toBe("answered");
    expect((await listMessages(testEnv.DB, inquiry.id)).at(-1)?.body).toBe("Yes, we can do it.\nNext week?");
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.to).toBe(client.email);
  });

  it("re-renders an empty or too long reply with an error", async () => {
    const { inquiry } = await makeInquiry({ tag: "hi-rerr", status: "open" });
    const { cookie } = await signIn("hi-rerr-b@vnx.si");
    const empty = await post(`/hub/inquiries/${inquiry.id}/reply`, { body: "  " }, cookie);
    expect(empty.status).toBe(400);
    const emptyHtml = await empty.text();
    expect(emptyHtml).toContain("Write a message first.");
    // VNX-0807: shared pattern (the thread is rendered inside HubLayout, which prefixes the title).
    expect(expectErrorSummary(emptyHtml, ["th-body"])).toContain("Reply: Write a message first.");
    expect(emptyHtml).toContain('aria-describedby="th-body-error"');
    const long = await post(`/hub/inquiries/${inquiry.id}/reply`, { body: "x".repeat(4001) }, cookie);
    expect(long.status).toBe(400);
    expect(outbox).toHaveLength(0);
    const longReason = await post(`/hub/inquiries/${inquiry.id}/decline`, { reason: "x".repeat(1001) }, cookie);
    expect(longReason.status).toBe(400);
    const reasonHtml = await longReason.text();
    expectErrorSummary(reasonHtml, ["th-reason"]);
    expect(reasonHtml).toContain('aria-describedby="th-reason-error"');
  });

  it("declines with an optional reason the client sees, and only while open", async () => {
    const { inquiry } = await makeInquiry({ tag: "hi-dec", status: "open" });
    const { cookie } = await signIn("hi-dec-b@vnx.si");
    expect((await post(`/hub/inquiries/${inquiry.id}/decline`, { reason: "Fully booked" }, cookie)).status).toBe(303);
    expect((await findInquiryById(testEnv.DB, inquiry.id))?.status).toBe("declined");
    const last = (await listMessages(testEnv.DB, inquiry.id)).at(-1);
    expect(last).toMatchObject({ kind: "decline", body: "Fully booked" });
    expect(outbox).toHaveLength(1);
    const thread = await (await get(`/hub/inquiries/${inquiry.id}`, cookie)).text();
    expect(thread).toContain("This inquiry is finished");
    expect(thread).not.toContain('name="body"');
    expect((await post(`/hub/inquiries/${inquiry.id}/reply`, { body: "Wait" }, cookie)).status).toBe(409);

    const answered = await makeInquiry({ tag: "hi-dec2", status: "answered" });
    const c2 = (await signIn("hi-dec2-b@vnx.si")).cookie;
    expect((await post(`/hub/inquiries/${answered.inquiry.id}/decline`, {}, c2)).status).toBe(409);
  });

  it("closes an inquiry and then refuses messages", async () => {
    const { inquiry } = await makeInquiry({ tag: "hi-close", status: "answered" });
    const { cookie } = await signIn("hi-close-b@vnx.si");
    expect((await post(`/hub/inquiries/${inquiry.id}/close`, {}, cookie)).status).toBe(303);
    expect((await findInquiryById(testEnv.DB, inquiry.id))?.status).toBe("closed");
    expect((await post(`/hub/inquiries/${inquiry.id}/close`, {}, cookie)).status).toBe(409);
    expect(outbox).toHaveLength(0);
  });

  it("blocks replies from a suspended builder", async () => {
    const { inquiry, builder } = await makeInquiry({ tag: "hi-susp", status: "open" });
    await setBuilderStatus(testEnv.DB, { userId: builder.userId, from: "approved", to: "suspended", reviewNote: null, now: new Date().toISOString() });
    const { cookie } = await signIn("hi-susp-b@vnx.si");
    expect((await post(`/hub/inquiries/${inquiry.id}/reply`, { body: "Hello" }, cookie)).status).toBe(409);
  });

  it("escapes message text", async () => {
    const { inquiry } = await makeInquiry({ tag: "hi-xss", status: "open" });
    const { cookie } = await signIn("hi-xss-b@vnx.si");
    await post(`/hub/inquiries/${inquiry.id}/reply`, { body: "<script>alert(1)</script>" }, cookie);
    const html = await (await get(`/hub/inquiries/${inquiry.id}`, cookie)).text();
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
