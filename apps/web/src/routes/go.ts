import type { Context, Hono } from "hono";
import { recordClick, type ClickInput } from "../db/clicks.ts";
import { isFlagEnabled } from "../db/flags.ts";
import { findDefaultOfferContext, findOfferWithContext, type RedirectRows } from "../db/offers.ts";
import { type CfLike, isBotRequest } from "../domain/bot.ts";
import { RESERVED_MERCHANT_SLUGS } from "../domain/merchant.ts";
import { resolveOfferRedirect } from "../domain/offer.ts";
import { CORRUPTION_REASONS, OFFER_ID_RE, countryOf, localeFromReferer, parseSrc, referrerHost } from "../domain/outbound.ts";
import { SLUG_RE } from "../domain/slug.ts";
import type { AppEnv } from "../env.ts";
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

/** waitUntil when the runtime has an ExecutionContext (Hono throws when it has none: tests, local), else wait for the write. */
async function defer(c: Context<AppEnv>, work: Promise<void>): Promise<void> {
  let ctx: { waitUntil(promise: Promise<unknown>): void } | null = null;
  try {
    ctx = c.executionCtx;
  } catch {
    ctx = null;
  }
  if (ctx) ctx.waitUntil(work);
  else await work;
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

export function registerGoRoutes(app: Hono<AppEnv>) {
  app.get("/go/o/:offerId", async (c) => {
    const id = c.req.param("offerId");
    if (!OFFER_ID_RE.test(id)) return notFound(c);
    return respond(c, await findOfferWithContext(c.env.DB, id));
  });

  app.get("/go/:merchantSlug", async (c) => {
    const slug = c.req.param("merchantSlug");
    if (RESERVED_MERCHANT_SLUGS.has(slug) || !SLUG_RE.test(slug)) return notFound(c);
    const rows = await findDefaultOfferContext(c.env.DB, slug);
    // A paused or archived merchant has no public /go/ (addendum §3.3), unlike /go/o/ where its offers fall back.
    return respond(c, rows !== null && rows.merchant.status === "active" ? rows : null);
  });

  // Everything else under /go/ that is not matched above (including /go/p/…, which is M7's) is a 404, never a static asset.
  app.get("/go/*", (c) => notFound(c));
  app.all("/go/*", (c) => c.body("Method Not Allowed", 405, { Allow: "GET, HEAD", ...NO_INDEX }));
}
