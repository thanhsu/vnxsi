import type { Context, Hono } from "hono";
import { isStaff } from "../auth/staff.ts";
import type { SessionUser } from "../auth/sessions.ts";
import { type ClickInput, hasClickToday, recordClick } from "../db/clicks.ts";
import { isFlagEnabled } from "../db/flags.ts";
import { findDefaultOfferContext, findOfferWithContext, type RedirectRows } from "../db/offers.ts";
import { findPublicProductBySlug } from "../db/products.ts";
import { bumpProductStat } from "../db/stats.ts";
import { type CfLike, isBotRequest } from "../domain/bot.ts";
import { RESERVED_MERCHANT_SLUGS } from "../domain/merchant.ts";
import { resolveOfferRedirect } from "../domain/offer.ts";
import { CORRUPTION_REASONS, OFFER_ID_RE, type OutboundSrc, countryOf, localeFromReferer, parseSrc, referrerHost } from "../domain/outbound.ts";
import { isCountingLive } from "../domain/privacy-notice.ts";
import { type ProductLinkKind, resolveProductLink } from "../domain/product-url.ts";
import { SLUG_RE } from "../domain/slug.ts";
import { utcDay } from "../domain/stats.ts";
import { hasGpc, shouldCount, usableSalt, visitorHash } from "../domain/visitor.ts";
import type { AppEnv, Bindings } from "../env.ts";
import { defer } from "../http/defer.ts";
import { readVisitorCookie, warnNoSaltOnce } from "../http/visitor.ts";
import type { Locale } from "../i18n/locales.ts";
import { ulid } from "../lib/ulid.ts";
import { errorResponse } from "../views/error-response.tsx";

/**
 * /go/:merchantSlug and /go/o/:offerId (addendum §2.1, §3.3; ADR-007). HIGH-RISK: the destination comes only from the database through
 * resolveOfferRedirect, and `Location` is the href that function re-validated. Nothing from the path or query ever reaches `Location`:
 * the query is read for `src` only, and only as an enum.
 */

const NO_INDEX = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } as const;

/** The default-locale 404 page (these paths have no locale prefix), never cached or indexed. */
function notFound(c: Context<AppEnv>): Promise<Response> {
  for (const [name, value] of Object.entries(NO_INDEX)) c.header(name, value);
  return errorResponse(c, "notFound", 404);
}

function redirectTo(url: string): Response {
  return new Response(null, { status: 302, headers: { Location: url, ...NO_INDEX, "Referrer-Policy": "origin" } });
}

/** Never rejects: a failed write is logged and must not touch the redirect. */
async function saveClick(db: D1Database, click: ClickInput): Promise<void> {
  try {
    await recordClick(db, click);
  } catch (err) {
    console.error(JSON.stringify({ event: "go.click_failed", clickId: click.id, error: String(err) }));
  }
}

async function respond(c: Context<AppEnv>, rows: RedirectRows | null): Promise<Response> {
  if (!rows?.offer) return notFound(c);
  const now = new Date();
  const clickId = ulid(now.getTime());
  const affiliate = await isFlagEnabled(c.env.DB, "affiliate", now.getTime());
  const partnerReferral = await isFlagEnabled(c.env.DB, "partner_referral", now.getTime());
  const url = new URL(c.req.url);
  const referer = c.req.header("referer");
  const locale = localeFromReferer(referer, url.host);
  const src = parseSrc(url.searchParams.get("src"));

  const result = resolveOfferRedirect({ ...rows, flags: { affiliate, partner_referral: partnerReferral }, now: now.toISOString(), clickId, locale, src });
  if (result.kind === "not_found") {
    if (CORRUPTION_REASONS.includes(result.reason)) {
      console.error(JSON.stringify({ event: "go.corrupt_data", reason: result.reason, offerId: rows.offer.id, merchantId: rows.merchant?.id ?? null, requestId: c.get("requestId") }));
    }
    return notFound(c);
  }

  // HEAD is answered by the GET handler (Hono); it must not count as a click.
  if (c.req.method === "GET") {
    const cf = c.req.raw.cf as CfLike;
    await defer(
      c,
      saveClick(c.env.DB, {
        id: clickId,
        productId: null,
        offerId: rows.offer.id,
        linkKind: "offer",
        src,
        locale,
        visitorHash: null,
        country: countryOf(cf),
        referrerHost: referrerHost(referer),
        isBot: isBotRequest(c.req.header("user-agent"), cf),
        createdAt: now.toISOString(),
      }),
    );
  }
  return redirectTo(result.url);
}

type ProductClick = {
  now: Date;
  clickId: string;
  productId: string;
  builderId: string;
  kind: ProductLinkKind;
  src: OutboundSrc;
  locale: Locale;
  referer: string | undefined;
  cf: CfLike;
  isBot: boolean;
  isGpc: boolean;
  visitorId: string | null;
  user: SessionUser | null;
};

/** Per isolate: keys (`hash|product|kind`) whose first click is still being recorded. Collapses a double click that lands in the same isolate. */
const inFlight = new Set<string>();

/**
 * The click row first and always; then, only for a counted first click of the day, the product counters. NEVER rejects (M2): everything
 * that decides "count or not" (go-live gate `isCountingLive`, hash, owner, staff, in-flight, dedupe) sits in one try/catch; on any error it logs `go.count_failed`,
 * counts nothing and still records the click (with the hash if it was computed, null if hashing failed). A redirect never waits on or
 * fails because of statistics (addendum 2.3). `isStaff` runs last, only for a signed-in visitor who is not the product's builder and
 * who already passed every cheap check (a hash exists only without bot, GPC, missing salt or missing cookie).
 */
async function trackProductClick(env: Bindings, t: ProductClick): Promise<void> {
  const day = utcDay(t.now);
  let hash: string | null = null;
  let first = false;
  let key: string | null = null;
  try {
    const salt = usableSalt(env.ANALYTICS_SALT);
    hash = salt !== null && !t.isBot && !t.isGpc && t.visitorId !== null && isCountingLive(env.PRIVACY_NOTICE_GO_LIVE, t.now) ? await visitorHash(salt, day, t.visitorId) : null;
    if (hash !== null) {
      const own = t.user?.id === t.builderId;
      const staff = !own && t.user ? await isStaff(env, t.user) : false;
      if (shouldCount({ isBot: t.isBot, isStaff: staff, isOwnBuilder: own, isGpc: t.isGpc, hasSalt: true })) {
        const k = `${hash}|${t.productId}|${t.kind}`;
        // Check and add with no await between them, so two requests of one isolate cannot both pass.
        if (!inFlight.has(k)) {
          inFlight.add(k);
          key = k;
          try {
            first = !(await hasClickToday(env.DB, { visitorHash: hash, productId: t.productId, linkKind: t.kind, day }));
          } catch (err) {
            console.error(JSON.stringify({ event: "go.dedupe_failed", productId: t.productId, error: String(err) }));
          }
        }
      }
    }
  } catch (err) {
    first = false;
    console.error(JSON.stringify({ event: "go.count_failed", productId: t.productId, error: String(err) }));
  }
  try {
    await saveClick(env.DB, {
      id: t.clickId,
      productId: t.productId,
      offerId: null,
      linkKind: t.kind,
      src: t.src,
      locale: t.locale,
      visitorHash: hash,
      country: countryOf(t.cf),
      referrerHost: referrerHost(t.referer),
      isBot: t.isBot,
      createdAt: t.now.toISOString(),
    });
    if (!first) return;
    try {
      await bumpProductStat(env.DB, { productId: t.productId, day, delta: t.kind === "demo" ? { demo_clicks: 1, outbound_clicks: 1 } : { outbound_clicks: 1 } });
    } catch (err) {
      console.error(JSON.stringify({ event: "go.stat_failed", productId: t.productId, error: String(err) }));
    }
  } finally {
    if (key !== null) inFlight.delete(key);
  }
}

async function respondProduct(c: Context<AppEnv>, kind: ProductLinkKind): Promise<Response> {
  const slug = c.req.param("slug") ?? "";
  if (!SLUG_RE.test(slug)) return notFound(c);
  const item = await findPublicProductBySlug(c.env.DB, slug);
  if (!item) return notFound(c);
  const result = resolveProductLink({ status: item.product.status, builderStatus: item.builderStatus, demoUrl: item.product.demoUrl, websiteUrl: item.product.websiteUrl }, kind);
  if (result.kind === "not_found") {
    if (result.reason === "invalid_url") {
      console.error(JSON.stringify({ event: "go.corrupt_data", reason: "product_url_invalid", productId: item.product.id, linkKind: kind, requestId: c.get("requestId") }));
    }
    return notFound(c);
  }
  // HEAD is answered by the GET handler (Hono); it must not record or count.
  if (c.req.method === "GET") {
    const now = new Date();
    const url = new URL(c.req.url);
    const referer = c.req.header("referer");
    const cf = c.req.raw.cf as CfLike;
    if (usableSalt(c.env.ANALYTICS_SALT) === null) warnNoSaltOnce();
    await defer(
      c,
      trackProductClick(c.env, {
        now,
        clickId: ulid(now.getTime()),
        productId: item.product.id,
        builderId: item.product.builderId,
        kind,
        src: parseSrc(url.searchParams.get("src")),
        locale: localeFromReferer(referer, url.host),
        referer,
        cf,
        isBot: isBotRequest(c.req.header("user-agent"), cf),
        isGpc: hasGpc(c.req.raw.headers),
        visitorId: readVisitorCookie(c),
        user: c.get("user"),
      }),
    );
  }
  return redirectTo(result.url);
}

export function registerGoRoutes(app: Hono<AppEnv>) {
  app.get("/go/o/:offerId", async (c) => {
    const id = c.req.param("offerId");
    if (!OFFER_ID_RE.test(id)) return notFound(c);
    return respond(c, await findOfferWithContext(c.env.DB, id));
  });

  // M7 (addendum 2.1): product links. Registered before the /go/* catch-all below, which would otherwise 404 them.
  app.get("/go/p/:slug/demo", (c) => respondProduct(c, "demo"));
  app.get("/go/p/:slug/site", (c) => respondProduct(c, "site"));

  app.get("/go/:merchantSlug", async (c) => {
    const slug = c.req.param("merchantSlug");
    if (RESERVED_MERCHANT_SLUGS.has(slug) || !SLUG_RE.test(slug)) return notFound(c);
    const rows = await findDefaultOfferContext(c.env.DB, slug);
    // A paused or archived merchant has no public /go/ (addendum §3.3), unlike /go/o/ where its offers fall back.
    return respond(c, rows !== null && rows.merchant.status === "active" ? rows : null);
  });

  // Everything else under /go/ that is not matched above is a 404, never a static asset.
  app.get("/go/*", (c) => notFound(c));
  app.all("/go/*", (c) => c.body("Method Not Allowed", 405, { Allow: "GET, HEAD", ...NO_INDEX }));
}
