import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { addMedia, listMedia } from "../../src/db/media.ts";
import type { Bindings } from "../../src/env.ts";
import { t } from "../../src/i18n/t.ts";
import { makeDraft, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

// VNX-0711: production runs without R2 until the Owner enables it; the MEDIA binding is then absent.
const noR2 = { ...testEnv, MEDIA: undefined } as Bindings;
const request = (req: Request, env: Bindings = noR2) => createApp().request(req, undefined, env);

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
function upload(productId: string, cookie: string, path = `/hub/products/${productId}/media`) {
  const form = new FormData();
  form.append("file", new File([PNG], "shot", { type: "image/png" }));
  form.append("alt", "Screenshot");
  return new Request(`https://vnx.si${path}`, { method: "POST", headers: { origin: "https://vnx.si", cookie }, body: form });
}

const WRANGLER = import.meta.glob("../../wrangler.jsonc", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

describe("running without R2 (VNX-0711)", () => {
  it("AC1: wrangler.jsonc binds no R2 bucket, and explains how to add MEDIA back", () => {
    const source = Object.values(WRANGLER)[0]!;
    const code = source
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, ""))
      .join("\n");
    expect(code).not.toContain("r2_buckets");
    expect(source).toMatch(/\/\/.*"r2_buckets"/);
    expect(source).toMatch(/\/\/.*\{ "binding": "MEDIA", "bucket_name": "vnxsi-media" \}/);
    expect(source).toContain("wrangler r2 bucket create vnxsi-media");
  });

  it("AC2: GET /media/* is 404", async () => {
    const res = await request(getReq("/media/products/01J9Z8Y7X6W5V4T3S2R1Q0P9N8/01J9Z8Y7X6W5V4T3S2R1Q0P9N9.webp"));
    expect(res.status).toBe(404);
  });

  it("AC2: an upload is refused with 503 and the notice, and writes no product_media row", async () => {
    const { product } = await makeDraft("r2-off-up@vnx.si", "r2-off-up", "Off Kit");
    const { cookie } = await signIn("r2-off-up@vnx.si");
    for (const path of [`/hub/products/${product.id}/media`, `/vi/hub/products/${product.id}/media`]) {
      const res = await request(upload(product.id, cookie, path));
      expect(res.status, path).toBe(503);
      const locale = path.startsWith("/vi/") ? "vi" : "en";
      expect(await res.text(), path).toContain(t(locale, "media.unavailable"));
    }
    expect(await listMedia(testEnv.DB, product.id)).toHaveLength(0);
  });

  it("AC2: deleting an image is refused with 503 and keeps the row", async () => {
    const { product } = await makeDraft("r2-off-del@vnx.si", "r2-off-del", "Del Kit");
    const { cookie } = await signIn("r2-off-del@vnx.si");
    const media = await addMedia(testEnv.DB, { productId: product.id, r2Key: `products/${product.id}/01J9Z8Y7X6W5V4T3S2R1Q0P9N8.png`, alt: "", now: new Date().toISOString() });
    const res = await request(formPost(`/hub/products/${product.id}/media/${media!.id}/delete`, {}, { cookie }));
    expect(res.status).toBe(503);
    expect(await res.text()).toContain(t("en", "media.unavailable"));
    expect(await listMedia(testEnv.DB, product.id)).toHaveLength(1);
  });

  it("AC2: the Demo step shows the notice instead of the upload form; other steps still save", async () => {
    const { product } = await makeDraft("r2-off-ed@vnx.si", "r2-off-ed", "Editor Kit");
    const { cookie } = await signIn("r2-off-ed@vnx.si");
    const res = await request(getReq(`/vi/hub/products/${product.id}/edit/demo`, cookie));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain(t("vi", "media.unavailable"));
    expect(html).not.toContain('enctype="multipart/form-data"');
    expect(html).not.toContain('name="file"');
    // The text form of the Demo step is still there.
    expect(html).toContain(`action="/vi/hub/products/${product.id}/edit/demo"`);
  });

  it("AC3: with R2 bound, the Demo step keeps the upload form and no notice", async () => {
    const { product } = await makeDraft("r2-on-ed@vnx.si", "r2-on-ed", "On Kit");
    const { cookie } = await signIn("r2-on-ed@vnx.si");
    const html = await (await request(getReq(`/hub/products/${product.id}/edit/demo`, cookie), testEnv)).text();
    expect(html).toContain('enctype="multipart/form-data"');
    expect(html).not.toContain(t("en", "media.unavailable"));
  });
});
