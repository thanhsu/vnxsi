import type { Context, Hono } from "hono";
import { requireBuilder } from "../auth/middleware.ts";
import { auditStatement, writeAudit } from "../db/audit.ts";
import { listMedia } from "../db/media.ts";
import { listTiers, replaceTiers } from "../db/pricing.ts";
import { createProductDraft, findOwnedProduct, listBuilderProducts, setProductStatus, updateProductFields, updateProductFieldsStatement, type ProductGuard } from "../db/products.ts";
import { revokeBadgeStatement } from "../db/verifications.ts";
import { canEditProfile } from "../domain/builder.ts";
import { isTextStep, parseProductName, parseStep, stepValuesFromBody, stepValuesFromProduct, type FieldErrorCode, type ProductFields, type StepErrors, type StepValues, type TextStep } from "../domain/product-input.ts";
import { parseTiers, tierValuesFromBody, tierValuesFromTiers, type TierErrors, type TierValues } from "../domain/pricing-input.ts";
import { canChangeSlug, editLock, submitGaps, transition, type EditLock, type Product, type ProductAction, type ReadinessGap } from "../domain/product.ts";
import type { AppEnv } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import { errorResponse } from "../views/error-response.tsx";
import { EditorLayout } from "../views/hub/EditorLayout.tsx";
import { EditorPage } from "../views/hub/EditorPage.tsx";
import type { MediaErrorCode } from "../views/hub/MediaSection.tsx";
import { PricingForm } from "../views/hub/PricingForm.tsx";
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

/** Lock and submit gaps shown on every editor page. */
export async function editorState(c: Context<AppEnv>, product: Product): Promise<{ lock: EditLock | null; gaps: ReadinessGap[] }> {
  const builder = c.get("builder");
  const [tiers, media] = await Promise.all([listTiers(c.env.DB, product.id), listMedia(c.env.DB, product.id)]);
  return {
    lock: editLock(product.status, builder.status),
    gaps: submitGaps({ product, builderStatus: builder.status, tierCount: tiers.length, mediaCount: media.length }),
  };
}

export type MediaError = MediaErrorCode;

export async function stepPage(
  c: Context<AppEnv>,
  product: Product,
  step: TextStep,
  values: StepValues,
  errors: StepErrors,
  status: 200 | 400 | 409 | 503 = 200,
  mediaError: MediaError | null = null,
) {
  const { lock, gaps } = await editorState(c, product);
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
      gaps={gaps}
      saved={c.req.query("saved") === "1"}
      media={media}
      mediaError={mediaError}
      mediaEnabled={c.env.MEDIA !== undefined}
    />,
    status,
  );
}

async function pricingPage(c: Context<AppEnv>, product: Product, values: TierValues, errors: TierErrors, status: 200 | 400 = 200) {
  const { lock, gaps } = await editorState(c, product);
  return page(
    c,
    <EditorLayout locale={c.get("locale")} origin={requestOrigin(c)} product={product} step="pricing" lock={lock} gaps={gaps} saved={c.req.query("saved") === "1"}>
      {lock ? null : <PricingForm locale={c.get("locale")} action={editorPath(c, product.id, "pricing")} values={values} errors={errors} />}
    </EditorLayout>,
    status,
  );
}

/**
 * The Demo step save as one transaction (run with db.batch): the field compare-and-set first, then — when the demo URL
 * changed — the system revoke of Demo verified (spec §7.2) and its audit row, then the `product.edit` audit row once
 * published. Every statement after the first is guarded on that compare-and-set, so a lost race (results[0] returned no
 * row) changes nothing.
 */
export function demoStepStatements(
  db: D1Database,
  input: { product: Product; actorUserId: string; fields: Partial<ProductFields>; now: string },
): D1PreparedStatement[] {
  const { product, fields, now } = input;
  const markEdited = product.firstPublishedAt !== null;
  const guard: ProductGuard = { productId: product.id, status: product.status, updatedAt: now };
  const statements = [updateProductFieldsStatement(db, { productId: product.id, builderId: product.builderId, expectedStatus: product.status, fields, now, markEdited })];
  const demoUrl = fields.demoUrl === undefined ? product.demoUrl : fields.demoUrl;
  if (demoUrl !== product.demoUrl) {
    const revoke = { kind: "demo_verified", reason: "demo_url_changed" } as const;
    statements.push(
      revokeBadgeStatement(db, { productId: product.id, ...revoke, now }, { ...guard, demoUrl }),
      auditStatement(db, { actorUserId: null, action: "badge.revoke", entity: "product", entityId: product.id, data: revoke, now }, { ...guard, revoked: revoke.kind }),
    );
  }
  if (markEdited) {
    statements.push(auditStatement(db, { actorUserId: input.actorUserId, action: "product.edit", entity: "product", entityId: product.id, data: { step: "demo" }, now }, guard));
  }
  return statements;
}

const OWNER_ACTIONS = new Set<ProductAction>(["submit", "withdraw", "unlist", "relist", "archive"]);

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

  onLocalized(app, "get", "/hub/products/:id/edit/pricing", requireBuilder, async (c) => {
    const product = await ownedProduct(c);
    if (!product) return errorResponse(c, "notFound", 404);
    return pricingPage(c, product, tierValuesFromTiers(await listTiers(c.env.DB, product.id)), {});
  });

  onLocalized(app, "post", "/hub/products/:id/edit/pricing", requireBuilder, async (c) => {
    const product = await ownedProduct(c);
    if (!product) return errorResponse(c, "notFound", 404);
    if (editLock(product.status, c.get("builder").status)) return errorResponse(c, "conflict", 409);
    const values = tierValuesFromBody(await c.req.parseBody());
    const parsed = parseTiers(values);
    if (!parsed.ok) return pricingPage(c, product, values, parsed.errors, 400);

    const now = new Date().toISOString();
    const markEdited = product.firstPublishedAt !== null;
    // Compare-and-set on status first, so a product that just went to review keeps the tiers it was submitted with.
    const touched = await updateProductFields(c.env.DB, { productId: product.id, builderId: product.builderId, expectedStatus: product.status, fields: {}, now, markEdited });
    if (touched !== "ok") return errorResponse(c, "conflict", 409);
    await replaceTiers(c.env.DB, { productId: product.id, tiers: parsed.tiers, now });
    if (markEdited) {
      await writeAudit(c.env.DB, { actorUserId: product.builderId, action: "product.edit", entity: "product", entityId: product.id, data: { step: "pricing" }, now });
    }
    return c.redirect(editorPath(c, product.id, "pricing", "?saved=1"), 303);
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
    if (step === "demo") {
      // One transaction, so a new demo URL never keeps Demo verified (spec §7.2).
      const results = await c.env.DB.batch(demoStepStatements(c.env.DB, { product, actorUserId: builder.userId, fields, now }));
      if ((results[0]?.results.length ?? 0) !== 1) return errorResponse(c, "conflict", 409);
      return c.redirect(editorPath(c, product.id, step, "?saved=1"), 303);
    }
    const markEdited = product.firstPublishedAt !== null;
    const result = await updateProductFields(c.env.DB, { productId: product.id, builderId: builder.userId, expectedStatus: product.status, fields, now, markEdited });
    if (result === "slug_taken") return stepPage(c, product, step, values, { slug: "slug_taken" }, 409);
    if (result === "stale") return errorResponse(c, "conflict", 409);
    if (markEdited) {
      await writeAudit(c.env.DB, { actorUserId: builder.userId, action: "product.edit", entity: "product", entityId: product.id, data: { step }, now });
    }
    return c.redirect(editorPath(c, product.id, step, "?saved=1"), 303);
  });

  // Registered last: `:action` must not shadow literal paths such as POST /hub/products/:id/media.
  onLocalized(app, "post", "/hub/products/:id/:action", requireBuilder, async (c) => {
    const action = c.req.param("action") as ProductAction;
    const product = await ownedProduct(c);
    if (!product || !OWNER_ACTIONS.has(action)) return errorResponse(c, "notFound", 404);
    const builder = c.get("builder");
    if (builder.status === "suspended") return errorResponse(c, "conflict", 409);
    const next = transition(product.status, action, "owner");
    if (!next.ok) return errorResponse(c, "conflict", 409);
    if (action === "submit") {
      const { gaps } = await editorState(c, product);
      if (gaps.length > 0) return stepPage(c, product, "product", stepValuesFromProduct("product", product), {}, 400);
    }
    const now = new Date().toISOString();
    const updated = await setProductStatus(c.env.DB, { id: product.id, from: product.status, to: next.status, reviewNote: product.reviewNote, now });
    if (!updated) return errorResponse(c, "conflict", 409);
    await writeAudit(c.env.DB, { actorUserId: builder.userId, action: `product.${action}`, entity: "product", entityId: product.id, data: { from: product.status, to: next.status }, now });
    if (action === "archive") return c.redirect(localizedPath(c.get("locale"), "/hub/products"), 303);
    return c.redirect(editorPath(c, product.id, "product"), 303);
  });
}
