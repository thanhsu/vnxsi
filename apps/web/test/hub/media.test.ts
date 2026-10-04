import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { addMedia, listMedia } from "../../src/db/media.ts";
import { findProductById, setProductStatus } from "../../src/db/products.ts";
import { makeBuilder, makeDraft, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 9]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 7]);

function upload(productId: string, cookie: string, bytes: Uint8Array, type = "image/png", alt = "Screenshot") {
  const form = new FormData();
  form.append("file", new File([bytes], "shot", { type }));
  form.append("alt", alt);
  return createApp().request(new Request(`https://vnx.si/hub/products/${productId}/media`, { method: "POST", headers: { origin: "https://vnx.si", cookie }, body: form }), undefined, testEnv);
}

const objects = async (productId: string) => (await testEnv.MEDIA!.list({ prefix: `products/${productId}/` })).objects.map((o) => o.key);

describe("product images (spec §8.5)", () => {
  it("uploads a PNG to R2, lists it on the Demo step and serves it immutably", async () => {
    const { product } = await makeDraft("md-png@vnx.si", "md-png", "Png Kit");
    const { cookie } = await signIn("md-png@vnx.si");
    const res = await upload(product.id, cookie, PNG);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`/hub/products/${product.id}/edit/demo?saved=1`);
    const [media] = await listMedia(testEnv.DB, product.id);
    expect(media?.r2Key).toMatch(new RegExp(`^products/${product.id}/[0-9A-Z]{26}\\.png$`));
    expect(media?.alt).toBe("Screenshot");

    const served = await createApp().request(getReq(`/media/${media!.r2Key}`), undefined, testEnv);
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/png");
    expect(served.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(served.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(PNG);

    const demo = await (await createApp().request(getReq(`/hub/products/${product.id}/edit/demo`, cookie), undefined, testEnv)).text();
    expect(demo).toContain(`src="/media/${media!.r2Key}"`);
    expect(demo).toContain('alt="Screenshot"');
  });

  it("accepts JPEG and WebP and names them by their real type", async () => {
    const { product } = await makeDraft("md-types@vnx.si", "md-types", "Types Kit");
    const { cookie } = await signIn("md-types@vnx.si");
    await upload(product.id, cookie, JPEG, "image/png");
    await upload(product.id, cookie, WEBP, "application/octet-stream");
    const keys = (await listMedia(testEnv.DB, product.id)).map((m) => m.r2Key.split(".").pop());
    expect(keys).toEqual(["jpg", "webp"]);
  });

  it("rejects files that are not JPEG, PNG or WebP, and files over 2 MB, leaving nothing in R2", async () => {
    const { product } = await makeDraft("md-bad@vnx.si", "md-bad", "Bad Kit");
    const { cookie } = await signIn("md-bad@vnx.si");
    const html = await upload(product.id, cookie, new TextEncoder().encode("<svg onload=alert(1)>"));
    expect(html.status).toBe(400);
    expect(await html.text()).toContain("Only JPEG, PNG or WebP images are accepted.");
    expect((await upload(product.id, cookie, new TextEncoder().encode("GIF89a...."), "image/gif")).status).toBe(400);
    const big = new Uint8Array(2 * 1024 * 1024 + 1);
    big.set(PNG);
    const tooBig = await upload(product.id, cookie, big);
    expect(tooBig.status).toBe(400);
    expect(await tooBig.text()).toContain("larger than 2 MB");
    expect(await listMedia(testEnv.DB, product.id)).toEqual([]);
    expect(await objects(product.id)).toEqual([]);
  });

  it("refuses an oversized upload from its Content-Length without reading the body", async () => {
    const { product } = await makeDraft("md-huge@vnx.si", "md-huge", "Huge Kit");
    const { cookie } = await signIn("md-huge@vnx.si");
    const big = new Uint8Array(3 * 1024 * 1024);
    big.set(PNG);
    const form = new FormData();
    form.append("file", new File([big], "huge.png", { type: "image/png" }));
    form.append("alt", "Huge");
    const encoded = new Response(form);
    const contentType = encoded.headers.get("content-type")!;
    const body = await encoded.arrayBuffer();
    const req = new Request(`https://vnx.si/hub/products/${product.id}/media`, {
      method: "POST",
      headers: { origin: "https://vnx.si", cookie, "content-type": contentType, "content-length": String(body.byteLength) },
      body,
    });
    const res = await createApp().request(req, undefined, testEnv);
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("larger than 2 MB");
    expect(req.bodyUsed).toBe(false);
    expect(await listMedia(testEnv.DB, product.id)).toEqual([]);
    expect(await objects(product.id)).toEqual([]);
  });

  it("refuses a 9th image (409) without leaving an object behind", async () => {
    const { product } = await makeDraft("md-full@vnx.si", "md-full", "Full Kit");
    for (let i = 0; i < 8; i++) {
      await addMedia(testEnv.DB, { productId: product.id, r2Key: `products/${product.id}/FAKE${i}.png`, alt: "", now: new Date().toISOString() });
    }
    const { cookie } = await signIn("md-full@vnx.si");
    expect((await upload(product.id, cookie, PNG)).status).toBe(409);
    expect(await objects(product.id)).toEqual([]);
  });

  it("deletes an image from D1 and R2", async () => {
    const { product } = await makeDraft("md-del@vnx.si", "md-del", "Del Kit");
    const { cookie } = await signIn("md-del@vnx.si");
    await upload(product.id, cookie, PNG);
    const [media] = await listMedia(testEnv.DB, product.id);
    const res = await createApp().request(formPost(`/hub/products/${product.id}/media/${media!.id}/delete`, {}, { cookie }), undefined, testEnv);
    expect(res.status).toBe(303);
    expect(await listMedia(testEnv.DB, product.id)).toEqual([]);
    expect(await objects(product.id)).toEqual([]);
    expect((await createApp().request(getReq(`/media/${media!.r2Key}`), undefined, testEnv)).status).toBe(404);
  });

  it("keeps other builders out (404) and blocks changes while in review (409)", async () => {
    const { product } = await makeDraft("md-owner@vnx.si", "md-owner", "Owner Kit");
    const owner = await signIn("md-owner@vnx.si");
    await upload(product.id, owner.cookie, PNG);
    const [media] = await listMedia(testEnv.DB, product.id);
    await makeBuilder("md-intruder@vnx.si", "md-intruder");
    const intruder = await signIn("md-intruder@vnx.si");
    expect((await upload(product.id, intruder.cookie, PNG)).status).toBe(404);
    expect((await createApp().request(formPost(`/hub/products/${product.id}/media/${media!.id}/delete`, {}, { cookie: intruder.cookie }), undefined, testEnv)).status).toBe(404);
    expect(await listMedia(testEnv.DB, product.id)).toHaveLength(1);

    await setProductStatus(testEnv.DB, { id: product.id, from: "draft", to: "in_review", reviewNote: null, now: new Date().toISOString() });
    expect((await upload(product.id, owner.cookie, PNG)).status).toBe(409);
  });

  it("flags a published product as edited when its images change", async () => {
    const { product } = await makeDraft("md-live@vnx.si", "md-live", "Live Media");
    const now = new Date().toISOString();
    await setProductStatus(testEnv.DB, { id: product.id, from: "draft", to: "in_review", reviewNote: null, now });
    await setProductStatus(testEnv.DB, { id: product.id, from: "in_review", to: "published", reviewNote: null, now });
    const { cookie } = await signIn("md-live@vnx.si");
    await upload(product.id, cookie, PNG);
    expect((await findProductById(testEnv.DB, product.id))?.editedAfterPublishAt).not.toBeNull();
  });

  it("404s on malformed media keys", async () => {
    for (const path of ["/media/products/../secret.png", "/media/products/x/y.png", "/media/products/01J0000000000000000000000A/01J0000000000000000000000B.png"]) {
      expect((await createApp().request(getReq(path), undefined, testEnv)).status, path).toBe(404);
    }
  });
});
