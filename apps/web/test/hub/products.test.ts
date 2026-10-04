import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { findProductById, setProductStatus } from "../../src/db/products.ts";
import { grantBadge, listActiveBadges } from "../../src/db/verifications.ts";
import { demoStepStatements } from "../../src/routes/hub-products.tsx";
import { ensureUser, makeBuilder, makeDraft, makeReadyProduct, publishProduct, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const app = () => createApp();
const productStep = (o: Record<string, string> = {}) => ({
  name: "Spa Booking",
  slug: "spa-booking-x",
  tagline: "Bookings for spas",
  category: "booking",
  deliveryModel: "saas",
  primaryLang: "en",
  tags: "spa",
  description: "Online booking.",
  ...o,
});
const audits = (action: string, id: string) =>
  testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = ?1 AND entity_id = ?2").bind(action, id).first<{ n: number }>().then((r) => r?.n ?? 0);

describe("Hub products list (spec §5.3)", () => {
  it("creates a draft and opens the editor", async () => {
    await makeBuilder("hp-create@vnx.si", "hp-create");
    const { cookie } = await signIn("hp-create@vnx.si");
    expect(await (await app().request(getReq("/hub/products", cookie), undefined, testEnv)).text()).toContain("No products yet.");
    const res = await app().request(formPost("/hub/products", { name: "Spa Booking Kit" }, { cookie }), undefined, testEnv);
    expect(res.status).toBe(303);
    const location = res.headers.get("location") ?? "";
    const id = /^\/hub\/products\/([0-9A-Z]{26})\/edit\/product$/.exec(location)?.[1];
    expect(id).toBeDefined();
    expect(await findProductById(testEnv.DB, id!)).toMatchObject({ status: "draft", slug: "spa-booking-kit" });
    expect(await audits("product.create", id!)).toBe(1);
    const list = await (await app().request(getReq("/hub/products", cookie), undefined, testEnv)).text();
    expect(list).toContain("Spa Booking Kit");
    expect(list).toContain("Draft");
  });

  it("rejects an empty name (400) and creation by a suspended builder (409)", async () => {
    await makeBuilder("hp-bad@vnx.si", "hp-bad");
    const { cookie } = await signIn("hp-bad@vnx.si");
    const res = await app().request(formPost("/hub/products", { name: " " }, { cookie }), undefined, testEnv);
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("This field is required.");
    await makeBuilder("hp-susp@vnx.si", "hp-susp", "suspended");
    const susp = await signIn("hp-susp@vnx.si");
    expect((await app().request(formPost("/hub/products", { name: "X" }, { cookie: susp.cookie }), undefined, testEnv)).status).toBe(409);
  });
});

describe("product editor text steps", () => {
  it("saves the product step, including a new slug, and shows localized steps", async () => {
    const { product } = await makeDraft("ed-prod@vnx.si", "ed-prod", "Kit");
    const { cookie } = await signIn("ed-prod@vnx.si");
    const res = await app().request(formPost(`/hub/products/${product.id}/edit/product`, productStep(), { cookie }), undefined, testEnv);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`/hub/products/${product.id}/edit/product?saved=1`);
    expect(await findProductById(testEnv.DB, product.id)).toMatchObject({ name: "Spa Booking", slug: "spa-booking-x", category: "booking", deliveryModel: "saas", tags: ["spa"] });
    const vi = await (await app().request(getReq(`/vi/hub/products/${product.id}/edit/features`, cookie), undefined, testEnv)).text();
    expect(vi).toContain("Tính năng");
    expect(vi).toContain('name="robots" content="noindex"');
  });

  it("refuses a bad slug (400) and a taken slug (409)", async () => {
    await makeDraft("ed-taken-a@vnx.si", "ed-taken-a", "Taken Name");
    const { product } = await makeDraft("ed-taken-b@vnx.si", "ed-taken-b", "Other Name");
    const { cookie } = await signIn("ed-taken-b@vnx.si");
    const bad = await app().request(formPost(`/hub/products/${product.id}/edit/product`, productStep({ slug: "Bad Slug" }), { cookie }), undefined, testEnv);
    expect(bad.status).toBe(400);
    const taken = await app().request(formPost(`/hub/products/${product.id}/edit/product`, productStep({ slug: "taken-name" }), { cookie }), undefined, testEnv);
    expect(taken.status).toBe(409);
    expect(await taken.text()).toContain("This address is already taken.");
  });

  it("saves features, demo, customization, license and support", async () => {
    const { product } = await makeDraft("ed-steps@vnx.si", "ed-steps", "Steps");
    const { cookie } = await signIn("ed-steps@vnx.si");
    const post = (step: string, body: Record<string, string>) => app().request(formPost(`/hub/products/${product.id}/edit/${step}`, body, { cookie }), undefined, testEnv);
    expect((await post("problem", { problem: "Lost bookings" })).status).toBe(303);
    expect((await post("audience", { targetUsers: "Spa owners" })).status).toBe(303);
    expect((await post("features", { features: "Calendar\nReminders", techStack: "Hono, D1" })).status).toBe(303);
    expect((await post("demo", { demoUrl: "http://insecure.example", websiteUrl: "" })).status).toBe(400);
    expect((await post("demo", { demoUrl: "https://demo.example", websiteUrl: "" })).status).toBe(303);
    expect((await post("customization", { customizable: "on", customizationNotes: "Branding" })).status).toBe(303);
    expect((await post("support", { supportPolicy: "Email within 48h" })).status).toBe(303);
    expect(await findProductById(testEnv.DB, product.id)).toMatchObject({
      problem: "Lost bookings",
      targetUsers: "Spa owners",
      features: ["Calendar", "Reminders"],
      techStack: ["Hono", "D1"],
      demoUrl: "https://demo.example",
      customizable: true,
      customizationNotes: "Branding",
      supportPolicy: "Email within 48h",
    });
  });

  it("keeps license only for source products", async () => {
    const { product } = await makeDraft("ed-lic@vnx.si", "ed-lic", "License");
    const { cookie } = await signIn("ed-lic@vnx.si");
    const post = (step: string, body: Record<string, string>) => app().request(formPost(`/hub/products/${product.id}/edit/${step}`, body, { cookie }), undefined, testEnv);
    await post("product", productStep({ slug: "lic-one", deliveryModel: "source" }));
    await post("license", { license: "extended" });
    expect((await findProductById(testEnv.DB, product.id))?.license).toBe("extended");
    await post("product", productStep({ slug: "lic-one", deliveryModel: "saas" }));
    expect((await findProductById(testEnv.DB, product.id))?.license).toBeNull();
    await post("license", { license: "extended" });
    expect((await findProductById(testEnv.DB, product.id))?.license).toBeNull();
  });

  it("404s on another builder's product and on an unknown step", async () => {
    const { product } = await makeDraft("ed-owner@vnx.si", "ed-owner", "Mine");
    await makeBuilder("ed-intruder@vnx.si", "ed-intruder");
    const { cookie } = await signIn("ed-intruder@vnx.si");
    expect((await app().request(getReq(`/hub/products/${product.id}/edit/product`, cookie), undefined, testEnv)).status).toBe(404);
    expect((await app().request(formPost(`/hub/products/${product.id}/edit/problem`, { problem: "Hacked" }, { cookie }), undefined, testEnv)).status).toBe(404);
    const own = await signIn("ed-owner@vnx.si");
    expect((await app().request(getReq(`/hub/products/${product.id}/edit/nope`, own.cookie), undefined, testEnv)).status).toBe(404);
    expect((await findProductById(testEnv.DB, product.id))?.problem).toBe("");
  });

  it("locks the editor while in review and for suspended builders (409)", async () => {
    const { product } = await makeDraft("ed-review@vnx.si", "ed-review", "Review");
    await setProductStatus(testEnv.DB, { id: product.id, from: "draft", to: "in_review", reviewNote: null, now: new Date().toISOString() });
    const { cookie } = await signIn("ed-review@vnx.si");
    const view = await (await app().request(getReq(`/hub/products/${product.id}/edit/problem`, cookie), undefined, testEnv)).text();
    expect(view).not.toContain(`action="/hub/products/${product.id}/edit/problem"`);
    expect((await app().request(formPost(`/hub/products/${product.id}/edit/problem`, { problem: "X" }, { cookie }), undefined, testEnv)).status).toBe(409);

    const s = await makeDraft("ed-susp@vnx.si", "ed-susp", "Susp", "suspended");
    const susp = await signIn("ed-susp@vnx.si");
    expect((await app().request(formPost(`/hub/products/${s.product.id}/edit/problem`, { problem: "X" }, { cookie: susp.cookie }), undefined, testEnv)).status).toBe(409);
  });

  it("publishes edits live, locks the slug and records them once published", async () => {
    const { product } = await makeDraft("ed-live@vnx.si", "ed-live", "Live Kit");
    const now = new Date().toISOString();
    await setProductStatus(testEnv.DB, { id: product.id, from: "draft", to: "in_review", reviewNote: null, now });
    await setProductStatus(testEnv.DB, { id: product.id, from: "in_review", to: "published", reviewNote: null, now });
    const { cookie } = await signIn("ed-live@vnx.si");
    await app().request(formPost(`/hub/products/${product.id}/edit/product`, productStep({ name: "Live Kit 2", slug: "changed-slug" }), { cookie }), undefined, testEnv);
    const after = await findProductById(testEnv.DB, product.id);
    expect(after).toMatchObject({ name: "Live Kit 2", slug: "live-kit", status: "published" });
    expect(after?.editedAfterPublishAt).not.toBeNull();
    expect(await audits("product.edit", product.id)).toBe(1);
  });

  it("revokes Demo verified when the demo URL changes", async () => {
    const { product } = await makeDraft("ed-demo@vnx.si", "ed-demo", "Demo Kit");
    const { cookie } = await signIn("ed-demo@vnx.si");
    const admin = await ensureUser("owner@vnx.si");
    await app().request(formPost(`/hub/products/${product.id}/edit/demo`, { demoUrl: "https://one.example", websiteUrl: "" }, { cookie }), undefined, testEnv);
    await grantBadge(testEnv.DB, { productId: product.id, kind: "demo_verified", verifiedBy: admin.id, evidence: "ok", now: new Date().toISOString() });
    await app().request(formPost(`/hub/products/${product.id}/edit/demo`, { demoUrl: "https://one.example", websiteUrl: "https://site.example" }, { cookie }), undefined, testEnv);
    expect((await listActiveBadges(testEnv.DB, product.id)).map((b) => b.kind)).toEqual(["demo_verified"]);
    await app().request(formPost(`/hub/products/${product.id}/edit/demo`, { demoUrl: "https://two.example", websiteUrl: "" }, { cookie }), undefined, testEnv);
    expect(await listActiveBadges(testEnv.DB, product.id)).toEqual([]);
    const row = await testEnv.DB.prepare("SELECT revoke_reason FROM product_verifications WHERE product_id = ?1").bind(product.id).first<{ revoke_reason: string }>();
    expect(row?.revoke_reason).toBe("demo_url_changed");
    expect(await audits("badge.revoke", product.id)).toBe(1);
  });

  it("changes nothing when the demo save loses its compare-and-set", async () => {
    const { builder, product } = await makeReadyProduct("ed-demo-stale@vnx.si", "ed-demo-stale", "Stale Demo");
    await publishProduct(product.id);
    const admin = await ensureUser("owner@vnx.si");
    await grantBadge(testEnv.DB, { productId: product.id, kind: "demo_verified", verifiedBy: admin.id, evidence: "ok", now: new Date().toISOString() });
    // The editor read the product while it was published; an admin suspends it before the save commits.
    const stale = (await findProductById(testEnv.DB, product.id))!;
    await setProductStatus(testEnv.DB, { id: product.id, from: "published", to: "suspended", reviewNote: null, now: new Date().toISOString() });
    const now = new Date(Date.now() + 1).toISOString();
    const statements = demoStepStatements(testEnv.DB, { product: stale, actorUserId: builder.userId, fields: { demoUrl: "https://two.example", websiteUrl: null }, now });
    const results = await testEnv.DB.batch(statements);
    expect(results[0]!.meta.changes).toBe(0);
    expect((await findProductById(testEnv.DB, product.id))?.demoUrl).toBe("https://demo.example");
    expect((await listActiveBadges(testEnv.DB, product.id)).map((b) => b.kind).sort()).toEqual(["demo_verified", "listed"]);
    expect(await audits("badge.revoke", product.id)).toBe(0);
    expect(await audits("product.edit", product.id)).toBe(0);
  });
});
