import type { Hono } from "hono";
import { listMedia } from "../db/media.ts";
import { listTiers } from "../db/pricing.ts";
import { findPublicProductBySlug } from "../db/products.ts";
import { recordProductView } from "../db/stats.ts";
import { listActiveBadges } from "../db/verifications.ts";
import { SLUG_RE } from "../domain/slug.ts";
import { utcDay } from "../domain/stats.ts";
import { visitorHash } from "../domain/visitor.ts";
import type { AppEnv, Bindings } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import { defer } from "../http/defer.ts";
import { onLocalized } from "../http/localized.ts";
import { siteOrigin } from "../http/origin.ts";
import { decideViewVisit, setVisitorCookie } from "../http/visitor.ts";
import { errorResponse } from "../views/error-response.tsx";
import { productJsonLd } from "../views/json-ld.ts";
import { ProductPage } from "../views/ProductPage.tsx";
import { page } from "../views/render.ts";

/** Never rejects: a failed write is logged and must not touch the page. The hash is computed here, off the request path. */
async function countView(env: Bindings, input: { productId: string; visitorId: string; now: Date }): Promise<void> {
  try {
    const hash = await visitorHash(env.ANALYTICS_SALT, utcDay(input.now), input.visitorId);
    if (hash === null) return;
    await recordProductView(env.DB, { productId: input.productId, visitorHash: hash, now: input.now });
  } catch (err) {
    console.error(JSON.stringify({ event: "product.view_failed", productId: input.productId, error: String(err) }));
  }
}

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
    const origin = siteOrigin(c);
    const jsonLd = productJsonLd({ product: item.product, tiers, url: origin + localizedPath(locale, `/p/${slug}`), image: media[0] ? `${origin}/media/${media[0].r2Key}` : null });
    // M7 (Owner (b) B1): one view per visitor per product per UTC day. Only GET (HEAD is answered by this handler and must not count).
    if (c.req.method === "GET") {
      const now = new Date();
      const visit = await decideViewVisit(c, item.product.builderId, now);
      if (visit.count) {
        if (visit.isNew) setVisitorCookie(c, visit.visitorId, now);
        await defer(c, countView(c.env, { productId: item.product.id, visitorId: visit.visitorId, now }));
      }
    }
    return page(c, <ProductPage locale={locale} origin={origin} item={item} tiers={tiers} media={media} badges={badges} jsonLd={jsonLd} signedIn={c.get("user") !== null} />);
  });
}
