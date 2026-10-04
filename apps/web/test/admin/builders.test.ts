import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { findBuilderByUserId } from "../../src/db/builders.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import type { Bindings } from "../../src/env.ts";
import { ensureUser, makeBuilder, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const app = () => createApp();
const admin = () => signIn("owner@vnx.si", { admin: true });

describe("admin builder queue (spec §5.5)", () => {
  beforeEach(() => clearOutbox());

  it("is for admins only", async () => {
    expect((await app().request(getReq("/admin/builders"), undefined, testEnv)).headers.get("location")).toBe("/login?next=%2Fadmin%2Fbuilders");
    const { cookie } = await signIn("adm-nobody@vnx.si");
    expect((await app().request(getReq("/admin/builders", cookie), undefined, testEnv)).status).toBe(403);
    expect((await app().request(formPost("/admin/builders/x/approve", {}, { cookie }), undefined, testEnv)).status).toBe(403);
  });

  it("lists builders by status with their e-mail", async () => {
    await makeBuilder("adm-list@vnx.si", "adm-list");
    const { cookie } = await admin();
    const html = await (await app().request(getReq("/admin/builders", cookie), undefined, testEnv)).text();
    expect(html).toContain("adm-list");
    expect(html).toContain("adm-list@vnx.si");
    const approved = await (await app().request(getReq("/admin/builders?status=approved", cookie), undefined, testEnv)).text();
    expect(approved).not.toContain("adm-list@vnx.si");
  });

  it("approves, e-mails the builder in their language and makes the profile public", async () => {
    await ensureUser("adm-approve@vnx.si", "vi");
    const b = await makeBuilder("adm-approve@vnx.si", "adm-approve");
    const { user, cookie } = await admin();
    expect((await app().request(getReq("/b/adm-approve"), undefined, testEnv)).status).toBe(404);

    const res = await app().request(formPost(`/admin/builders/${b.userId}/approve`, {}, { cookie }), undefined, testEnv);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`/admin/builders/${b.userId}?done=1`);
    expect(await findBuilderByUserId(testEnv.DB, b.userId)).toMatchObject({ status: "approved" });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ to: "adm-approve@vnx.si", subject: "Hồ sơ builder của bạn trên VNX.SI đã được duyệt" });
    expect(outbox[0]!.text).toContain("https://vnx.si/vi/b/adm-approve");
    const audit = await testEnv.DB.prepare("SELECT actor_user_id FROM audit_log WHERE action = 'builder.approve' AND entity_id = ?1").bind(b.userId).first<{ actor_user_id: string }>();
    expect(audit?.actor_user_id).toBe(user.id);
    expect((await app().request(getReq("/b/adm-approve"), undefined, testEnv)).status).toBe(200);
    expect(await (await app().request(getReq(`/admin/builders/${b.userId}?done=1`, cookie), undefined, testEnv)).text()).toContain("Saved.");
  });

  it("requires a reason to reject and sends it to the builder", async () => {
    const b = await makeBuilder("adm-reject@vnx.si", "adm-reject");
    const { cookie } = await admin();
    const missing = await app().request(formPost(`/admin/builders/${b.userId}/reject`, { reason: "  " }, { cookie }), undefined, testEnv);
    expect(missing.status).toBe(400);
    expect(await missing.text()).toContain("Enter a reason (up to 500 characters).");
    expect(outbox).toHaveLength(0);

    await app().request(formPost(`/admin/builders/${b.userId}/reject`, { reason: "Add real projects" }, { cookie }), undefined, testEnv);
    expect(await findBuilderByUserId(testEnv.DB, b.userId)).toMatchObject({ status: "rejected", reviewNote: "Add real projects" });
    expect(outbox[0]!.text).toContain("Add real projects");
  });

  it("returns 409 for a decision on a builder that is no longer pending", async () => {
    const b = await makeBuilder("adm-twice@vnx.si", "adm-twice", "approved");
    const { cookie } = await admin();
    expect((await app().request(formPost(`/admin/builders/${b.userId}/approve`, {}, { cookie }), undefined, testEnv)).status).toBe(409);
  });

  it("keeps the decision and tells the admin when the e-mail fails", async () => {
    const b = await makeBuilder("adm-nomail@vnx.si", "adm-nomail");
    const { cookie } = await admin();
    const noMail = { ...testEnv, MAIL_DRIVER: undefined } as Bindings;
    const res = await app().request(formPost(`/admin/builders/${b.userId}/approve`, {}, { cookie }), undefined, noMail);
    expect(res.headers.get("location")).toBe(`/admin/builders/${b.userId}?done=mail_failed`);
    expect(await findBuilderByUserId(testEnv.DB, b.userId)).toMatchObject({ status: "approved" });
  });

  it("404s on an unknown builder", async () => {
    const { cookie } = await admin();
    expect((await app().request(getReq("/admin/builders/01ZZZZZZZZZZZZZZZZZZZZZZZZ", cookie), undefined, testEnv)).status).toBe(404);
  });
});
