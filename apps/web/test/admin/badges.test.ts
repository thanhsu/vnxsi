import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { listActiveBadges } from "../../src/db/verifications.ts";
import { makeReadyProduct, publishProduct, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const admin = () => signIn("owner@vnx.si", { admin: true });
const post = (path: string, cookie: string, body: Record<string, string> = {}) => createApp().request(formPost(path, body, { cookie }), undefined, testEnv);
const kinds = async (id: string) => (await listActiveBadges(testEnv.DB, id)).map((b) => b.kind).sort();

describe("admin badges (spec §5.5, §7.2)", () => {
  it("grants Demo verified with evidence, once", async () => {
    const { product } = await makeReadyProduct("bd-grant@vnx.si", "bd-grant", "Grant Kit");
    await publishProduct(product.id);
    const { user, cookie } = await admin();
    const res = await post(`/admin/products/${product.id}/badges`, cookie, { kind: "demo_verified", evidence: "Booked a slot on the demo" });
    expect(res.headers.get("location")).toBe(`/admin/products/${product.id}?done=1`);
    const badges = await listActiveBadges(testEnv.DB, product.id);
    expect(badges.find((b) => b.kind === "demo_verified")).toMatchObject({ verifiedBy: user.id, evidence: "Booked a slot on the demo" });
    expect((await post(`/admin/products/${product.id}/badges`, cookie, { kind: "demo_verified", evidence: "Again" })).status).toBe(409);
    const audit = await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'badge.grant' AND entity_id = ?1").bind(product.id).first<{ n: number }>();
    expect(audit?.n).toBe(1);
  });

  it("hides the grant form once both badges are active", async () => {
    const { product } = await makeReadyProduct("bd-both@vnx.si", "bd-both", "Both Kit");
    await publishProduct(product.id);
    const { cookie } = await admin();
    const form = `action="/admin/products/${product.id}/badges"`;
    const detail = async () => (await createApp().request(getReq(`/admin/products/${product.id}`, cookie), undefined, testEnv)).text();
    await post(`/admin/products/${product.id}/badges`, cookie, { kind: "demo_verified", evidence: "Tried it" });
    expect(await detail()).toContain(form);
    await post(`/admin/products/${product.id}/badges`, cookie, { kind: "in_production", evidence: "Live at a client" });
    expect(await kinds(product.id)).toEqual(["demo_verified", "in_production", "listed"]);
    expect(await detail()).not.toContain(form);
  });

  it("requires evidence and a grantable kind (400)", async () => {
    const { product } = await makeReadyProduct("bd-bad@vnx.si", "bd-bad", "Bad Badge Kit");
    await publishProduct(product.id);
    const { cookie } = await admin();
    const noEvidence = await post(`/admin/products/${product.id}/badges`, cookie, { kind: "in_production", evidence: " " });
    expect(noEvidence.status).toBe(400);
    expect(await noEvidence.text()).toContain("Describe the evidence (up to 500 characters).");
    expect((await post(`/admin/products/${product.id}/badges`, cookie, { kind: "listed", evidence: "x" })).status).toBe(400);
    expect(await kinds(product.id)).toEqual(["listed"]);
  });

  it("revokes with a reason", async () => {
    const { product } = await makeReadyProduct("bd-revoke@vnx.si", "bd-revoke", "Revoke Kit");
    await publishProduct(product.id);
    const { cookie } = await admin();
    await post(`/admin/products/${product.id}/badges`, cookie, { kind: "in_production", evidence: "Live at a client" });
    expect((await post(`/admin/products/${product.id}/badges/in_production/revoke`, cookie, { reason: "" })).status).toBe(400);
    expect((await post(`/admin/products/${product.id}/badges/in_production/revoke`, cookie, { reason: "Client stopped using it" })).status).toBe(303);
    expect(await kinds(product.id)).toEqual(["listed"]);
    expect((await post(`/admin/products/${product.id}/badges/in_production/revoke`, cookie, { reason: "Again" })).status).toBe(409);
  });

  it("loses Demo verified when the builder changes the demo URL (M3 exit gate)", async () => {
    const { product } = await makeReadyProduct("bd-demo@vnx.si", "bd-demo", "Demo Gate Kit");
    await publishProduct(product.id);
    const { cookie: adminCookie } = await admin();
    await post(`/admin/products/${product.id}/badges`, adminCookie, { kind: "demo_verified", evidence: "Tried it" });
    const { cookie } = await signIn("bd-demo@vnx.si");
    await post(`/hub/products/${product.id}/edit/demo`, cookie, { demoUrl: "https://new-demo.example", websiteUrl: "" });
    expect(await kinds(product.id)).toEqual(["listed"]);
    const detail = await (await createApp().request(getReq(`/admin/products/${product.id}`, adminCookie), undefined, testEnv)).text();
    expect(detail).not.toContain("Demo verified ·");
  });
});

describe("recently edited products (spec §5.5)", () => {
  it("lists published products edited in the last 14 days", async () => {
    const fresh = await makeReadyProduct("bd-fresh@vnx.si", "bd-fresh", "Fresh Edit Kit");
    await publishProduct(fresh.product.id);
    const old = await makeReadyProduct("bd-old@vnx.si", "bd-old", "Old Edit Kit");
    await publishProduct(old.product.id);
    const draft = await makeReadyProduct("bd-draft@vnx.si", "bd-draft", "Draft Edit Kit");

    const builder = await signIn("bd-fresh@vnx.si");
    await post(`/hub/products/${fresh.product.id}/edit/problem`, builder.cookie, { problem: "Updated problem" });
    const longAgo = new Date(Date.now() - 15 * 86_400_000).toISOString();
    await testEnv.DB.prepare("UPDATE products SET edited_after_publish_at = ?2 WHERE id = ?1").bind(old.product.id, longAgo).run();
    // A draft is never "recently edited", even with the flag set.
    await testEnv.DB.prepare("UPDATE products SET edited_after_publish_at = ?2 WHERE id = ?1").bind(draft.product.id, new Date().toISOString()).run();

    const { cookie } = await admin();
    const html = await (await createApp().request(getReq("/admin/products?view=edited", cookie), undefined, testEnv)).text();
    expect(html).toContain("Fresh Edit Kit");
    expect(html).not.toContain("Old Edit Kit");
    expect(html).not.toContain("Draft Edit Kit");
  });
});
