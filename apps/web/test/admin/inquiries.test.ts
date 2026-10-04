import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { findInquiryById } from "../../src/db/inquiries.ts";
import { makeInquiry, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const app = () => createApp();

describe("admin inquiries (spec §5.5)", () => {
  it("lists inquiries with the client's e-mail for the admin and filters by status", async () => {
    const { inquiry, client } = await makeInquiry({ tag: "ai-list", status: "open" });
    await makeInquiry({ tag: "ai-list2", status: "closed" });
    const { cookie } = await signIn("owner@vnx.si", { admin: true });
    const html = await (await app().request(getReq("/admin/inquiries?status=open", cookie), undefined, testEnv)).text();
    expect(html).toContain(client.email);
    expect(html).toContain(inquiry.id);
    expect(html).not.toContain("ai-list2-c@vnx.si");
    expect((await app().request(getReq("/admin/inquiries?status=bogus", cookie), undefined, testEnv)).status).toBe(200);
  });

  it("removes an inquiry as spam, once, with an audit row", async () => {
    const { inquiry } = await makeInquiry({ tag: "ai-rm", status: "answered" });
    const { cookie } = await signIn("owner@vnx.si", { admin: true });
    const res = await app().request(formPost(`/admin/inquiries/${inquiry.id}/remove`, {}, { cookie }), undefined, testEnv);
    expect(res.status).toBe(303);
    expect((await findInquiryById(testEnv.DB, inquiry.id))?.status).toBe("removed");
    expect((await app().request(formPost(`/admin/inquiries/${inquiry.id}/remove`, {}, { cookie }), undefined, testEnv)).status).toBe(409);
    const audit = await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'inquiry.remove' AND entity_id = ?1").bind(inquiry.id).first<{ n: number }>();
    expect(audit?.n).toBe(1);
  });

  it("is admin-only", async () => {
    const { inquiry } = await makeInquiry({ tag: "ai-auth", status: "open" });
    const { cookie } = await signIn("ai-auth-b@vnx.si");
    expect((await app().request(getReq("/admin/inquiries", cookie), undefined, testEnv)).status).toBe(403);
    expect((await app().request(formPost(`/admin/inquiries/${inquiry.id}/remove`, {}, { cookie }), undefined, testEnv)).status).toBe(403);
  });
});
