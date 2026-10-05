import type { Hono } from "hono";
import { isFlagEnabled } from "../db/flags.ts";
import { findMerchantBySlug } from "../db/merchants.ts";
import { listActiveMerchantOffers } from "../db/offers.ts";
import { toolIndexable, visibleOffers } from "../domain/offer.ts";
import { SLUG_RE } from "../domain/slug.ts";
import type { AppEnv } from "../env.ts";
import { onLocalized } from "../http/localized.ts";
import { siteOrigin } from "../http/origin.ts";
import { localizedPath } from "../i18n/locales.ts";
import { errorResponse } from "../views/error-response.tsx";
import { page } from "../views/render.ts";
import { ToolPage } from "../views/ToolPage.tsx";

/** /tools/:slug: a merchant's public page (VNX-2104a). Only `active` merchants; offers are the ones /go/ can follow right now. */
export function registerToolsRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/tools/:slug", async (c) => {
    const raw = c.req.param("slug") ?? "";
    const slug = raw.toLowerCase();
    if (!SLUG_RE.test(slug)) return errorResponse(c, "notFound", 404);
    const locale = c.get("locale");
    if (raw !== slug) return c.redirect(localizedPath(locale, `/tools/${slug}`), 301);
    const merchant = await findMerchantBySlug(c.env.DB, slug);
    if (!merchant || merchant.status !== "active") return errorResponse(c, "notFound", 404);
    const rows = await listActiveMerchantOffers(c.env.DB, merchant.id);
    // Sequential: the first read fills the 60 s cache, the others hit it.
    const flags = { affiliate: await isFlagEnabled(c.env.DB, "affiliate"), partner_referral: await isFlagEnabled(c.env.DB, "partner_referral") };
    const indexing = await isFlagEnabled(c.env.DB, "content_indexing");
    const offers = visibleOffers({ merchant, rows, flags, now: new Date().toISOString() });
    return page(
      c,
      <ToolPage locale={locale} origin={siteOrigin(c)} merchant={merchant} offers={offers} noindex={!toolIndexable(merchant, indexing)} signedIn={c.get("user") !== null} />,
    );
  });
}
