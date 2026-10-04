import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { findProductById, setProductStatus } from "../../src/db/products.ts";
import { makeBuilder, makeDraft, makeReadyProduct, publishProduct, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const act = (id: string, action: string, cookie: string) => createApp().request(formPost(`/hub/products/${id}/${action}`, {}, { cookie }), undefined, testEnv);
const status = async (id: string) => (await findProductById(testEnv.DB, id))?.status;

describe("submit conditions in the editor (spec §7.2)", () => {
  it("lists what is missing, hides Submit and refuses it (400)", async () => {
    const { product } = await makeDraft("lc-gaps@vnx.si", "lc-gaps", "Gaps");
    const { cookie } = await signIn("lc-gaps@vnx.si");
    const html = await (await createApp().request(getReq(`/hub/products/${product.id}/edit/support`, cookie), undefined, testEnv)).text();
    expect(html).toContain("Before you can submit:");
    expect(html).toContain("Upload at least one image");
    expect(html).toContain(`href="/hub/products/${product.id}/edit/pricing"`);
    expect(html).not.toContain(`action="/hub/products/${product.id}/submit"`);
    expect((await act(product.id, "submit", cookie)).status).toBe(400);
    expect(await status(product.id)).toBe("draft");
  });

  it("requires an approved builder", async () => {
    const { product } = await makeReadyProduct("lc-pending@vnx.si", "lc-pending", "Pending Kit", { builderStatus: "pending" });
    const { cookie } = await signIn("lc-pending@vnx.si");
    expect((await act(product.id, "submit", cookie)).status).toBe(400);
    expect(await status(product.id)).toBe("draft");
  });

  it("requires a license for source products", async () => {
    const { product } = await makeReadyProduct("lc-source@vnx.si", "lc-source", "Source Kit", { deliveryModel: "source" });
    const { cookie } = await signIn("lc-source@vnx.si");
    const html = await (await createApp().request(getReq(`/hub/products/${product.id}/edit/license`, cookie), undefined, testEnv)).text();
    expect(html).toContain("Choose a license for source code");
    expect((await act(product.id, "submit", cookie)).status).toBe(400);
  });
});

describe("product lifecycle in the Hub", () => {
  it("submits, withdraws and submits again", async () => {
    const { product } = await makeReadyProduct("lc-submit@vnx.si", "lc-submit", "Ready Kit");
    const { cookie } = await signIn("lc-submit@vnx.si");
    const editor = await (await createApp().request(getReq(`/hub/products/${product.id}/edit/product`, cookie), undefined, testEnv)).text();
    expect(editor).toContain(`action="/hub/products/${product.id}/submit"`);
    const res = await act(product.id, "submit", cookie);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`/hub/products/${product.id}/edit/product`);
    expect(await status(product.id)).toBe("in_review");
    const audit = await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'product.submit' AND entity_id = ?1").bind(product.id).first<{ n: number }>();
    expect(audit?.n).toBe(1);
    expect((await act(product.id, "submit", cookie)).status).toBe(409);
    await act(product.id, "withdraw", cookie);
    expect(await status(product.id)).toBe("draft");
    await act(product.id, "submit", cookie);
    expect(await status(product.id)).toBe("in_review");
  });

  it("lets a builder resubmit after changes were requested", async () => {
    const { product } = await makeReadyProduct("lc-changes@vnx.si", "lc-changes", "Changes Kit");
    const now = new Date().toISOString();
    await setProductStatus(testEnv.DB, { id: product.id, from: "draft", to: "in_review", reviewNote: null, now });
    await setProductStatus(testEnv.DB, { id: product.id, from: "in_review", to: "changes_requested", reviewNote: "Add a real screenshot", now });
    const { cookie } = await signIn("lc-changes@vnx.si");
    expect(await (await createApp().request(getReq(`/hub/products/${product.id}/edit/demo`, cookie), undefined, testEnv)).text()).toContain("Add a real screenshot");
    await act(product.id, "submit", cookie);
    expect(await status(product.id)).toBe("in_review");
  });

  it("hides, shows again and archives a published product", async () => {
    const { product } = await makeReadyProduct("lc-live@vnx.si", "lc-live", "Live Kit");
    await publishProduct(product.id);
    const { cookie } = await signIn("lc-live@vnx.si");
    await act(product.id, "unlist", cookie);
    expect(await status(product.id)).toBe("unlisted");
    await act(product.id, "relist", cookie);
    expect(await status(product.id)).toBe("published");
    const archived = await act(product.id, "archive", cookie);
    expect(archived.headers.get("location")).toBe("/hub/products");
    expect(await status(product.id)).toBe("archived");
    expect(await (await createApp().request(getReq("/hub/products", cookie), undefined, testEnv)).text()).not.toContain("Live Kit");
    expect((await createApp().request(getReq(`/hub/products/${product.id}/edit/product`, cookie), undefined, testEnv)).status).toBe(404);
  });

  it("refuses invalid moves (409), other builders (404), suspended builders (409) and unknown actions (404)", async () => {
    const { product } = await makeReadyProduct("lc-guard@vnx.si", "lc-guard", "Guard Kit");
    const { cookie } = await signIn("lc-guard@vnx.si");
    expect((await act(product.id, "withdraw", cookie)).status).toBe(409);
    expect((await act(product.id, "relist", cookie)).status).toBe(409);
    expect((await act(product.id, "approve", cookie)).status).toBe(404);
    await makeBuilder("lc-intruder@vnx.si", "lc-intruder");
    const intruder = await signIn("lc-intruder@vnx.si");
    expect((await act(product.id, "archive", intruder.cookie)).status).toBe(404);
    const susp = await makeReadyProduct("lc-susp@vnx.si", "lc-susp", "Susp Kit", { builderStatus: "suspended" });
    const suspCookie = await signIn("lc-susp@vnx.si");
    expect((await act(susp.product.id, "archive", suspCookie.cookie)).status).toBe(409);
    expect(await status(product.id)).toBe("draft");
  });
});

describe("editor notices and links by status", () => {
  const editor = async (id: string, cookie: string) => (await createApp().request(getReq(`/hub/products/${id}/edit/product`, cookie), undefined, testEnv)).text();
  const LIVE = "This product is live: your changes appear right away.";
  const HIDDEN = "This product is hidden from the marketplace. Changes are saved and will show when you make it visible again.";

  it("shows the suspend reason to the builder", async () => {
    const { product } = await makeReadyProduct("lc-reason@vnx.si", "lc-reason", "Reason Kit");
    await publishProduct(product.id);
    await setProductStatus(testEnv.DB, { id: product.id, from: "published", to: "suspended", reviewNote: "Broken demo link", now: new Date().toISOString() });
    const { cookie } = await signIn("lc-reason@vnx.si");
    const html = await editor(product.id, cookie);
    expect(html).toContain("Broken demo link");
    expect(html).toContain("Changes requested by the admin:");
  });

  it("says a hidden product is hidden, not live", async () => {
    const { product } = await makeReadyProduct("lc-hidden@vnx.si", "lc-hidden", "Hidden Kit");
    await publishProduct(product.id);
    const { cookie } = await signIn("lc-hidden@vnx.si");
    expect(await editor(product.id, cookie)).toContain(LIVE);
    await act(product.id, "unlist", cookie);
    const html = await editor(product.id, cookie);
    expect(html).toContain(HIDDEN);
    expect(html).not.toContain(LIVE);
    const vi = await (await createApp().request(getReq(`/vi/hub/products/${product.id}/edit/product`, cookie), undefined, testEnv)).text();
    expect(vi).toContain("Sản phẩm đang ẩn khỏi marketplace.");
  });

  it("links a published product to its public page", async () => {
    const { product } = await makeReadyProduct("lc-public@vnx.si", "lc-public", "Public Link Kit");
    const draft = await makeReadyProduct("lc-draftlink@vnx.si", "lc-draftlink", "Draft Link Kit");
    const live = await publishProduct(product.id);
    const { cookie } = await signIn("lc-public@vnx.si");
    const list = await (await createApp().request(getReq("/hub/products", cookie), undefined, testEnv)).text();
    expect(list).toContain(`href="/p/${live.slug}"`);
    expect(list).toContain("View public page");
    expect(await editor(product.id, cookie)).toContain(`href="/p/${live.slug}"`);
    const vi = await (await createApp().request(getReq("/vi/hub/products", cookie), undefined, testEnv)).text();
    expect(vi).toContain(`href="/vi/p/${live.slug}"`);
    const other = await signIn("lc-draftlink@vnx.si");
    expect(await (await createApp().request(getReq("/hub/products", other.cookie), undefined, testEnv)).text()).not.toContain(`href="/p/${draft.product.slug}"`);
  });
});

describe("Hub overview product counts (spec §5.3)", () => {
  it("shows products by status", async () => {
    const { product } = await makeReadyProduct("lc-count@vnx.si", "lc-count", "Count A");
    await publishProduct(product.id);
    const { cookie } = await signIn("lc-count@vnx.si");
    const html = await (await createApp().request(getReq("/hub", cookie), undefined, testEnv)).text();
    expect(html).toContain("Published: 1");
    expect(html).toContain('href="/hub/products"');
  });
});
