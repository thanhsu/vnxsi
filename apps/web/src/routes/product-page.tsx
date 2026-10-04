import type { Hono } from "hono";
import { listMedia } from "../db/media.ts";
import { listTiers } from "../db/pricing.ts";
import { findPublicProductBySlug } from "../db/products.ts";
import { listActiveBadges } from "../db/verifications.ts";
import { SLUG_RE } from "../domain/slug.ts";
import type { AppEnv } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import { errorResponse } from "../views/error-response.tsx";
import { productJsonLd } from "../views/json-ld.ts";
import { ProductPage } from "../views/ProductPage.tsx";
import { page } from "../views/render.ts";

export function registerProductPageRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/p/:slug", async (c) => {
    const raw = c.req.param("slug") ?? "";
    const slug = raw.toLowerCase();
    if (!SLUG_RE.test(slug)) return errorResponse(c, "notFound", 404);
    const locale = c.get("locale");
    if (raw !== slug) return c.redirect(localizedPath(locale, `/p/${slug}`), 301);
    const item = await findPublicProductBySlug(c.env.DB, slug);
    if (!item) return errorResponse(c, "notFound", 404);
    const [tiers, media, badges] = await Promise.all([listTiers(c.env.DB, item.product.id), listMedia(c.env.DB, item.product.id), listActiveBadges(c.env.DB, item.product.id)]);
    const origin = requestOrigin(c);
    const jsonLd = productJsonLd({ product: item.product, tiers, url: origin + localizedPath(locale, `/p/${slug}`), image: media[0] ? `${origin}/media/${media[0].r2Key}` : null });
    return page(c, <ProductPage locale={locale} origin={origin} item={item} tiers={tiers} media={media} badges={badges} jsonLd={jsonLd} signedIn={c.get("user") !== null} />);
  });
}
