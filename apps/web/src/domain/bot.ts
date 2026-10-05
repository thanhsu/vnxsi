/** The one bot rule (spec 8.11) for views, clicks and de-duplication. Pure: no Hono, no D1. */

/** The two fields of `request.cf` that the rule reads. */
export type CfLike = { country?: unknown; botManagement?: { verifiedBot?: unknown } } | null | undefined;

export const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|preview|monitor|curl|wget|python-requests|headlesschrome/i;

/**
 * Empty or blank User-Agent, a User-Agent matching BOT_UA, or Cloudflare's `verifiedBot`. Spec 8.11 also says "cf.botManagement if
 * present" but gives no score threshold, so the score is NOT read (no invented number). Never blocks a request: callers only skip counting.
 */
export function isBotRequest(userAgent: string | null | undefined, cf: CfLike): boolean {
  if (!userAgent || userAgent.trim() === "") return true;
  return BOT_UA.test(userAgent) || cf?.botManagement?.verifiedBot === true;
}
