import type { Context, Hono } from "hono";
import { requireBuilder } from "../auth/middleware.ts";
import { writeAudit } from "../db/audit.ts";
import { listMedia } from "../db/media.ts";
import { createProductDraft, findOwnedProduct, listBuilderProducts, updateProductFields } from "../db/products.ts";
import { revokeBadge } from "../db/verifications.ts";
import { canEditProfile } from "../domain/builder.ts";
import { isTextStep, parseProductName, parseStep, stepValuesFromBody, stepValuesFromProduct, type FieldErrorCode, type StepErrors, type StepValues, type TextStep } from "../domain/product-input.ts";
import { canChangeSlug, editLock, type Product } from "../domain/product.ts";
import type { AppEnv } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import { errorResponse } from "../views/error-response.tsx";
import { EditorPage } from "../views/hub/EditorPage.tsx";
import type { MediaErrorCode } from "../views/hub/MediaSection.tsx";
import { ProductsPage } from "../views/hub/ProductsPage.tsx";
import { page } from "../views/render.ts";

const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/** The signed-in builder's product (archived reads as missing), or null. Exported for Tasks 3–5. */
export async function ownedProduct(c: Context<AppEnv>): Promise<Product | null> {
  const id = c.req.param("id") ?? "";
  if (!ULID.test(id)) return null;
  const product = await findOwnedProduct(c.env.DB, c.get("builder").userId, id);
  return product && product.status !== "archived" ? product : null;
}

export function editorPath(c: Context<AppEnv>, productId: string, step: string, query = ""): string {
  return localizedPath(c.get("locale"), `/hub/products/${productId}/edit/${step}${query}`);
}

async function listPage(c: Context<AppEnv>, name: string, error: FieldErrorCode | null, status: 200 | 400 = 200) {
  const builder = c.get("builder");
  const products = await listBuilderProducts(c.env.DB, builder.userId);
  return page(
    c,
    <ProductsPage locale={c.get("locale")} origin={requestOrigin(c)} products={products} name={name} error={error} canCreate={canEditProfile(builder.status)} />,
    status,
  );
}

export type MediaError = MediaErrorCode;

export async function stepPage(
  c: Context<AppEnv>,
  product: Product,
  step: TextStep,
  values: StepValues,
  errors: StepErrors,
  status: 200 | 400 | 409 = 200,
  mediaError: MediaError | null = null,
) {
  const lock = editLock(product.status, c.get("builder").status);
  const media = step === "demo" ? await listMedia(c.env.DB, product.id) : [];
  return page(
    c,
    <EditorPage
      locale={c.get("locale")}
      origin={requestOrigin(c)}
      product={product}
      step={step}
      values={values}
      errors={errors}
      lock={lock}
      saved={c.req.query("saved") === "1"}
      media={media}
      mediaError={mediaError}
    />,
    status,
  );
}

export function registerProductEditorRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/hub/products", requireBuilder, (c) => listPage(c, "", null));

  onLocalized(app, "post", "/hub/products", requireBuilder, async (c) => {
    const builder = c.get("builder");
    if (!canEditProfile(builder.status)) return errorResponse(c, "conflict", 409);
    const body = await c.req.parseBody();
    const parsed = parseProductName(body.name);
    if (!parsed.ok) return listPage(c, typeof body.name === "string" ? body.name : "", parsed.error, 400);
    const now = new Date().toISOString();
    const product = await createProductDraft(c.env.DB, { builderId: builder.userId, name: parsed.name, now });
    await writeAudit(c.env.DB, { actorUserId: builder.userId, action: "product.create", entity: "product", entityId: product.id, now });
    return c.redirect(editorPath(c, product.id, "product"), 303);
  });

  onLocalized(app, "get", "/hub/products/:id/edit", requireBuilder, async (c) => {
    const product = await ownedProduct(c);
    if (!product) return errorResponse(c, "notFound", 404);
    return c.redirect(editorPath(c, product.id, "product"), 303);
  });

  onLocalized(app, "get", "/hub/products/:id/edit/:step", requireBuilder, async (c) => {
    const step = c.req.param("step");
    const product = await ownedProduct(c);
    if (!product || !isTextStep(step)) return errorResponse(c, "notFound", 404);
    return stepPage(c, product, step, stepValuesFromProduct(step, product), {});
  });

  onLocalized(app, "post", "/hub/products/:id/edit/:step", requireBuilder, async (c) => {
    const step = c.req.param("step");
    const product = await ownedProduct(c);
    if (!product || !isTextStep(step)) return errorResponse(c, "notFound", 404);
    const builder = c.get("builder");
    if (editLock(product.status, builder.status)) return errorResponse(c, "conflict", 409);

    const values = stepValuesFromBody(step, await c.req.parseBody());
    // The slug locks after the first publish (spec §6.1): ignore whatever was posted.
    if (step === "product" && !canChangeSlug(product)) values.slug = product.slug;
    const parsed = parseStep(step, values);
    if (!parsed.ok) return stepPage(c, product, step, values, parsed.errors, 400);

    const fields = parsed.fields;
    // License only exists for source products (spec §6.1).
    if (step === "product" && fields.deliveryModel !== "source") fields.license = null;
    if (step === "license" && product.deliveryModel !== "source") fields.license = null;

    const now = new Date().toISOString();
    const markEdited = product.firstPublishedAt !== null;
    const result = await updateProductFields(c.env.DB, { productId: product.id, builderId: builder.userId, expectedStatus: product.status, fields, now, markEdited });
    if (result === "slug_taken") return stepPage(c, product, step, values, { slug: "slug_taken" }, 409);
    if (result === "stale") return errorResponse(c, "conflict", 409);

    // Spec §7.2: a new demo URL invalidates Demo verified.
    if (step === "demo" && fields.demoUrl !== product.demoUrl) {
      const revoked = await revokeBadge(c.env.DB, { productId: product.id, kind: "demo_verified", reason: "demo_url_changed", now });
      if (revoked) {
        await writeAudit(c.env.DB, { actorUserId: null, action: "badge.revoke", entity: "product", entityId: product.id, data: { kind: "demo_verified", reason: "demo_url_changed" }, now });
      }
    }
    if (markEdited) {
      await writeAudit(c.env.DB, { actorUserId: builder.userId, action: "product.edit", entity: "product", entityId: product.id, data: { step }, now });
    }
    return c.redirect(editorPath(c, product.id, step, "?saved=1"), 303);
  });
}
