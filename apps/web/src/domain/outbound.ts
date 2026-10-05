import { DEFAULT_LOCALE, localeFromPath, type Locale } from "../i18n/locales.ts";
import { isPublicHostname } from "./offer-url.ts";
import type { NotFoundReason } from "./offer.ts";

/** Pure helpers for /go/ and the outbound click log (addendum §2.1–2.2). No I/O. */

/** The only `src` values /go/ reads (addendum §2.1); anything else is stored as `unknown`. */
export const OUTBOUND_SRCS = ["product_page", "builder_page", "catalog", "home", "article", "tools"] as const;
export type OutboundSrc = (typeof OUTBOUND_SRCS)[number] | "unknown";

export function parseSrc(raw: unknown): OutboundSrc {
  return typeof raw === "string" && (OUTBOUND_SRCS as readonly string[]).includes(raw) ? (raw as OutboundSrc) : "unknown";
}

/** An offer id is a ULID; anything else never reaches D1. */
export const OFFER_ID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/** Owner 2026-10-05: keep clicks 13 months. 395 days, a fixed number so tests can pin it. */
export const OUTBOUND_CLICK_RETENTION_DAYS = 395;
/** The daily job deletes at most BATCH * MAX_BATCHES rows per run; the rest waits for the next run. */
export const OUTBOUND_CLICK_PURGE_BATCH = 5000;
export const OUTBOUND_CLICK_PURGE_MAX_BATCHES = 10;

/** Rows older than this ISO instant are deleted (a row exactly at the cutoff is kept). */
export function purgeCutoff(now: Date): string {
  return new Date(now.getTime() - OUTBOUND_CLICK_RETENTION_DAYS * 86_400_000).toISOString();
}

/** `resolveOfferRedirect` not_found reasons that mean the data is broken (not a dead link): /go/ logs them with console.error. */
export const CORRUPTION_REASONS: readonly NotFoundReason[] = ["program_missing", "program_merchant", "template_missing", "window_invalid", "invalid_url", "website_invalid", "subject_merchant"];

/** The two fields of `request.cf` that /go/ reads. */
export type CfLike = { country?: unknown; botManagement?: { verifiedBot?: unknown } } | null | undefined;

const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|preview|monitor|curl|wget|python-requests|headlesschrome/i;

/** Marks a click as `is_bot`; never blocks the redirect. M7 may replace this with the shared rule of spec 8.11. */
export function isBotRequest(userAgent: string | null | undefined, cf: CfLike): boolean {
  if (!userAgent || userAgent.trim() === "") return true;
  return BOT_UA.test(userAgent) || cf?.botManagement?.verifiedBot === true;
}

/**
 * Host name only (lower case, no port, path, query or credentials); null for anything that is not an http(s) URL, and null when the host
 * is an IP literal (v4 or v6), localhost or another non-public name: Privacy promises "domain only" and no IP address.
 */
export function referrerHost(referer: string | null | undefined): string | null {
  if (!referer) return null;
  try {
    const u = new URL(referer);
    return (u.protocol === "https:" || u.protocol === "http:") && isPublicHostname(u.hostname) ? u.hostname : null;
  } catch {
    return null;
  }
}

/** The locale of the page that held the link, from a Referer on this same host (`host` includes the port); `en` otherwise. */
export function localeFromReferer(referer: string | null | undefined, host: string): Locale {
  if (!referer) return DEFAULT_LOCALE;
  try {
    const u = new URL(referer);
    return u.host === host ? localeFromPath(u.pathname).locale : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function countryOf(cf: CfLike): string | null {
  const country = cf?.country;
  return typeof country === "string" && /^[A-Z]{2}$/.test(country) ? country : null;
}
