import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { findInquiryById } from "../../src/db/inquiries.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import { makeInquiry, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const app = () => createApp();
const get = (path: string, cookie?: string) => app().request(getReq(path, cookie), undefined, testEnv);
const post = (path: string, fields: Record<string, string>, cookie: string) => app().request(formPost(path, fields, { cookie }), undefined, testEnv);

describe("/me (spec §5.4)", () => {
  beforeEach(() => clearOutbox());

  it("requires sign-in", async () => {
    const res = await get("/vi/me");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/vi/login?next=%2Fvi%2Fme");
  });

  it("lists the client's inquiries, including one waiting for e-mail confirmation", async () => {
    const open = await makeInquiry({ tag: "me-list", status: "open" });
    const { cookie } = await signIn(open.client.email);
    const html = await (await get("/me", cookie)).text();
    expect(html).toContain("To me-list builder");
    expect(html).toContain(`href="/me/inquiries/${open.inquiry.id}"`);
    const pending = await makeInquiry({ tag: "me-pend", status: "pending_verification" });
    const pc = (await signIn(pending.client.email)).cookie;
    expect(await (await get(`/me/inquiries/${pending.inquiry.id}`, pc)).text()).toContain("Waiting for you to confirm your e-mail.");
  });

  it("lets the client reply (status kept) and close; the builder is notified of the reply", async () => {
    const { inquiry, client } = await makeInquiry({ tag: "me-reply", status: "answered" });
    const { cookie } = await signIn(client.email);
    expect((await post(`/me/inquiries/${inquiry.id}/reply`, { body: "Thanks, sounds good." }, cookie)).status).toBe(303);
    expect((await findInquiryById(testEnv.DB, inquiry.id))?.status).toBe("answered");
    expect(outbox[0]?.to).toBe("me-reply-b@vnx.si");
    expect((await post(`/me/inquiries/${inquiry.id}/close`, {}, cookie)).status).toBe(303);
    expect((await findInquiryById(testEnv.DB, inquiry.id))?.status).toBe("closed");
  });

  it("does not let the client decline, nor post on a pending inquiry", async () => {
    const open = await makeInquiry({ tag: "me-dec", status: "open" });
    const { cookie } = await signIn(open.client.email);
    expect((await post(`/me/inquiries/${open.inquiry.id}/decline`, {}, cookie)).status).toBe(404);
    const pending = await makeInquiry({ tag: "me-pend2", status: "pending_verification" });
    const pc = (await signIn(pending.client.email)).cookie;
    expect((await post(`/me/inquiries/${pending.inquiry.id}/reply`, { body: "Hello?" }, pc)).status).toBe(409);
  });

  it("hides other clients' and removed inquiries", async () => {
    const a = await makeInquiry({ tag: "me-a", status: "open" });
    const b = await makeInquiry({ tag: "me-b", status: "removed" });
    const { cookie } = await signIn(a.client.email);
    expect((await get(`/me/inquiries/${b.inquiry.id}`, cookie)).status).toBe(404);
    const bc = (await signIn(b.client.email)).cookie;
    expect((await get(`/me/inquiries/${b.inquiry.id}`, bc)).status).toBe(404);
    expect(await (await get("/me", bc)).text()).toContain("No inquiries yet.");
  });

  it("links to /me from the header when signed in", async () => {
    const { cookie } = await signIn("me-nav@vnx.si");
    const html = await (await get("/zh-hant/products", cookie)).text();
    const header = /<header class="site-header">([\s\S]*?)<\/header>/.exec(html)?.[1] ?? "";
    expect(header).toContain('<a href="/zh-hant/me">我的詢問</a>');
  });
});
