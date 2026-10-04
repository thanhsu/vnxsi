import type { Context, Hono } from "hono";
import { requireBuilder } from "../auth/middleware.ts";
import { writeAudit } from "../db/audit.ts";
import { addMedia, deleteMedia, findMedia, listMedia } from "../db/media.ts";
import { updateProductFields } from "../db/products.ts";
import { sniffImage } from "../domain/image.ts";
import { normalizeNewlines, stepValuesFromProduct } from "../domain/product-input.ts";
import { editLock, MAX_MEDIA, MAX_MEDIA_BYTES, type Product } from "../domain/product.ts";
import type { AppEnv } from "../env.ts";
import { onLocalized } from "../http/localized.ts";
import { deleteImage, productMediaKey, putImage } from "../media/r2.ts";
import { errorResponse } from "../views/error-response.tsx";
import { editorPath, ownedProduct, stepPage, type MediaError } from "./hub-products.tsx";

const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

function demoWithError(c: Context<AppEnv>, product: Product, error: MediaError, status: 400 | 409) {
  return stepPage(c, product, "demo", stepValuesFromProduct("demo", product), {}, status, error);
}

/** Images are part of the product: changing them after the first publish counts as an edit (spec §7.2). */
async function touchEdited(c: Context<AppEnv>, product: Product, now: string) {
  if (product.firstPublishedAt === null) return;
  await updateProductFields(c.env.DB, { productId: product.id, builderId: product.builderId, expectedStatus: product.status, fields: {}, now, markEdited: true });
  await writeAudit(c.env.DB, { actorUserId: product.builderId, action: "product.edit", entity: "product", entityId: product.id, data: { step: "media" }, now });
}

export function registerProductMediaRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "post", "/hub/products/:id/media", requireBuilder, async (c) => {
    const product = await ownedProduct(c);
    if (!product) return errorResponse(c, "notFound", 404);
    if (editLock(product.status, c.get("builder").status)) return errorResponse(c, "conflict", 409);

    const body = await c.req.parseBody();
    const file = body.file;
    if (!(file instanceof File) || file.size === 0) return demoWithError(c, product, "missing", 400);
    if (file.size > MAX_MEDIA_BYTES) return demoWithError(c, product, "size", 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length > MAX_MEDIA_BYTES) return demoWithError(c, product, "size", 400);
    const ext = sniffImage(bytes);
    if (!ext) return demoWithError(c, product, "type", 400);
    const alt = normalizeNewlines(typeof body.alt === "string" ? body.alt : "").trim();
    if (alt.length > 150) return demoWithError(c, product, "alt", 400);
    if ((await listMedia(c.env.DB, product.id)).length >= MAX_MEDIA) return demoWithError(c, product, "full", 409);

    const now = new Date().toISOString();
    const key = productMediaKey(product.id, ext, now);
    await putImage(c.env.MEDIA, key, bytes, ext);
    const added = await addMedia(c.env.DB, { productId: product.id, r2Key: key, alt, now });
    if (!added) {
      // Lost the race for the last slot: don't leave an orphan object in R2.
      await deleteImage(c.env.MEDIA, key);
      return demoWithError(c, product, "full", 409);
    }
    await touchEdited(c, product, now);
    return c.redirect(editorPath(c, product.id, "demo", "?saved=1"), 303);
  });

  onLocalized(app, "post", "/hub/products/:id/media/:mediaId/delete", requireBuilder, async (c) => {
    const product = await ownedProduct(c);
    const mediaId = c.req.param("mediaId") ?? "";
    if (!product || !ULID.test(mediaId)) return errorResponse(c, "notFound", 404);
    const media = await findMedia(c.env.DB, product.id, mediaId);
    if (!media) return errorResponse(c, "notFound", 404);
    if (editLock(product.status, c.get("builder").status)) return errorResponse(c, "conflict", 409);

    await deleteMedia(c.env.DB, product.id, media.id);
    try {
      await deleteImage(c.env.MEDIA, media.r2Key);
    } catch (err) {
      // The row is gone, so the image is no longer shown; an orphan object only costs storage.
      console.error(JSON.stringify({ requestId: c.get("requestId"), event: "media.delete_failed", key: media.r2Key, error: String(err) }));
    }
    await touchEdited(c, product, new Date().toISOString());
    return c.redirect(editorPath(c, product.id, "demo", "?saved=1"), 303);
  });
}
