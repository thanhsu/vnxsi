import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { findInquiryById, listMessages } from "../../src/db/inquiries.ts";
import { findUserById } from "../../src/db/users.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import { zhHant } from "../../src/i18n/messages/zh-hant.ts";
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
    expect(await (await get(`/me/inquiries/${pending.inquiry.id}`, pc)).text()).toContain("Not sent yet.");
  });

  it('offers "Send now" for a pending inquiry; posting it opens the inquiry, notifies the builder once and names the account', async () => {
    const { inquiry, client } = await makeInquiry({ tag: "me-now", status: "pending_verification" });
    const { cookie } = await signIn(client.email);
    const html = await (await get(`/me/inquiries/${inquiry.id}`, cookie)).text();
    expect(html).toContain("Send now");
    expect(html).toContain(`action="/me/inquiries/${inquiry.id}/confirm"`);
    expect((await findUserById(testEnv.DB, client.id))?.display_name).toBeNull();
    const counted = async () => (await testEnv.DB.prepare("SELECT COALESCE(SUM(inquiries), 0) AS n FROM product_daily_stats WHERE product_id = ?1").bind(inquiry.productId).first<{ n: number }>())?.n;
    expect(await counted()).toBe(0);
    const res = await post(`/vi/me/inquiries/${inquiry.id}/confirm`, {}, cookie);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`/vi/me/inquiries/${inquiry.id}`);
    const opened = await findInquiryById(testEnv.DB, inquiry.id);
    expect(opened?.status).toBe("open");
    expect(opened?.openedAt).not.toBeNull();
    expect(await counted()).toBe(1);
    expect((await findUserById(testEnv.DB, client.id))?.display_name).toBe("Minh Tran");
    expect(outbox.filter((m) => m.to === "me-now-b@vnx.si")).toHaveLength(1);
    const [first] = await listMessages(testEnv.DB, inquiry.id);
    expect(first?.notifiedAt).not.toBeNull();
    const audit = await testEnv.DB.prepare("SELECT data FROM audit_log WHERE action = 'inquiry.verify' AND entity_id = ?1").bind(inquiry.id).first<{ data: string }>();
    expect(JSON.parse(audit!.data)).toEqual({ via: "me" });
    // A second press: already open -> 409, nothing more is sent.
    expect((await post(`/me/inquiries/${inquiry.id}/confirm`, {}, cookie)).status).toBe(409);
    expect(await counted()).toBe(1);
    expect(outbox.filter((m) => m.to === "me-now-b@vnx.si")).toHaveLength(1);
  });

  it("404s Send now for another client's inquiry and for a removed one", async () => {
    const mine = await makeInquiry({ tag: "me-now2", status: "pending_verification" });
    const other = await makeInquiry({ tag: "me-now3", status: "pending_verification" });
    const { cookie } = await signIn(mine.client.email);
    expect((await post(`/me/inquiries/${other.inquiry.id}/confirm`, {}, cookie)).status).toBe(404);
    expect((await findInquiryById(testEnv.DB, other.inquiry.id))?.status).toBe("pending_verification");
    await testEnv.DB.prepare("UPDATE inquiries SET status = 'removed' WHERE id = ?1").bind(mine.inquiry.id).run();
    expect((await post(`/me/inquiries/${mine.inquiry.id}/confirm`, {}, cookie)).status).toBe(404);
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
    expect(header).toContain(`<a class="nav-account" href="/zh-hant/me">${zhHant["nav.me"]}</a>`);
  });
});
