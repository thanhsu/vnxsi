import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { findProductById, setProductStatus } from "../../src/db/products.ts";
import { listActiveBadges } from "../../src/db/verifications.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import type { Bindings } from "../../src/env.ts";
import { ensureUser, makeReadyProduct, publishProduct, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const admin = () => signIn("owner@vnx.si", { admin: true });
const submit = (id: string) => setProductStatus(testEnv.DB, { id, from: "draft", to: "in_review", reviewNote: null, now: new Date().toISOString() });
const decide = (id: string, action: string, cookie: string, body: Record<string, string> = {}, env: Bindings = testEnv) =>
  createApp().request(formPost(`/admin/products/${id}/${action}`, body, { cookie }), undefined, env);

describe("admin product queue (spec §5.5)", () => {
  beforeEach(() => clearOutbox());

  it("is for admins only", async () => {
    expect((await createApp().request(getReq("/admin/products"), undefined, testEnv)).headers.get("location")).toBe("/login?next=%2Fadmin%2Fproducts");
    const { cookie } = await signIn("ap-nobody@vnx.si");
    expect((await createApp().request(getReq("/admin/products", cookie), undefined, testEnv)).status).toBe(403);
    expect((await decide("01ZZZZZZZZZZZZZZZZZZZZZZZZ", "approve", cookie)).status).toBe(403);
  });

  it("lists products waiting for review with their builder", async () => {
    const { product } = await makeReadyProduct("ap-list@vnx.si", "ap-list", "Queue Kit");
    await submit(product.id);
    const { cookie } = await admin();
    const html = await (await createApp().request(getReq("/admin/products", cookie), undefined, testEnv)).text();
    expect(html).toContain("Queue Kit");
    expect(html).toContain("ap-list");
    const detail = await (await createApp().request(getReq(`/admin/products/${product.id}`, cookie), undefined, testEnv)).text();
    expect(detail).toContain("$19");
    expect(detail).toContain(`src="/media/products/${product.id}/`);
  });

  it("approves: publishes, adds the listed badge and e-mails the builder in their language", async () => {
    await ensureUser("ap-approve@vnx.si", "vi");
    const { product } = await makeReadyProduct("ap-approve@vnx.si", "ap-approve", "Approve Kit");
    await submit(product.id);
    const { user, cookie } = await admin();
    const res = await decide(product.id, "approve", cookie);
    expect(res.headers.get("location")).toBe(`/admin/products/${product.id}?done=1`);
    const after = await findProductById(testEnv.DB, product.id);
    expect(after).toMatchObject({ status: "published", reviewNote: null });
    expect(after?.firstPublishedAt).not.toBeNull();
    const badges = await listActiveBadges(testEnv.DB, product.id);
    expect(badges.map((b) => [b.kind, b.verifiedBy])).toEqual([["listed", null]]);
    expect(outbox[0]).toMatchObject({ to: "ap-approve@vnx.si", subject: "Sản phẩm của bạn trên VNX.SI đã được duyệt" });
    expect(outbox[0]!.text).toContain(`https://vnx.si/vi/p/${after!.slug}`);
    const audit = await testEnv.DB.prepare("SELECT actor_user_id FROM audit_log WHERE action = 'product.approve' AND entity_id = ?1").bind(product.id).first<{ actor_user_id: string }>();
    expect(audit?.actor_user_id).toBe(user.id);
    expect((await decide(product.id, "approve", cookie)).status).toBe(409);
  });

  it("requires a note to request changes and sends it to the builder", async () => {
    const { product } = await makeReadyProduct("ap-changes@vnx.si", "ap-changes", "Changes Kit");
    await submit(product.id);
    const { cookie } = await admin();
    const missing = await decide(product.id, "request_changes", cookie, { note: " " });
    expect(missing.status).toBe(400);
    expect(await missing.text()).toContain("Enter a note (up to 1000 characters).");
    await decide(product.id, "request_changes", cookie, { note: "Add a real screenshot\r\nplease" });
    expect(await findProductById(testEnv.DB, product.id)).toMatchObject({ status: "changes_requested", reviewNote: "Add a real screenshot\nplease" });
    expect(outbox[0]!.text).toContain("Add a real screenshot");
  });

  it("suspends and restores a published product", async () => {
    const { product } = await makeReadyProduct("ap-susp@vnx.si", "ap-susp", "Susp Kit");
    await publishProduct(product.id);
    const { cookie } = await admin();
    await decide(product.id, "suspend", cookie, { note: "Broken demo" });
    expect(await findProductById(testEnv.DB, product.id)).toMatchObject({ status: "suspended", reviewNote: "Broken demo" });
    expect((await decide(product.id, "suspend", cookie)).status).toBe(409);
    await decide(product.id, "unsuspend", cookie);
    expect(await findProductById(testEnv.DB, product.id)).toMatchObject({ status: "published", reviewNote: null });
    expect(outbox).toHaveLength(0);
  });

  it("keeps the approval when the e-mail fails", async () => {
    const { product } = await makeReadyProduct("ap-nomail@vnx.si", "ap-nomail", "No Mail Kit");
    await submit(product.id);
    const { cookie } = await admin();
    const res = await decide(product.id, "approve", cookie, {}, { ...testEnv, MAIL_DRIVER: undefined } as Bindings);
    expect(res.headers.get("location")).toBe(`/admin/products/${product.id}?done=mail_failed`);
    expect((await findProductById(testEnv.DB, product.id))?.status).toBe("published");
  });

  it("404s on unknown products", async () => {
    const { cookie } = await admin();
    expect((await createApp().request(getReq("/admin/products/01ZZZZZZZZZZZZZZZZZZZZZZZZ", cookie), undefined, testEnv)).status).toBe(404);
    expect((await decide("01ZZZZZZZZZZZZZZZZZZZZZZZZ", "approve", cookie)).status).toBe(404);
  });
});
