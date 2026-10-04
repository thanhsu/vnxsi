import { z } from "zod";

/** Same check as the pre-pivot landing form (spec §5.8), kept so earlier entries stay comparable. */
export const WAITLIST_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** utm_* and the referrer host are stored at most this long. */
export const MAX_META = 200;
/** A bare lower-case hostname: no scheme, port, path, query, user info or spaces. */
const HOSTNAME_RE = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;

export type Utm = { utmSource: string | null; utmMedium: string | null; utmCampaign: string | null };

/** One client signup from the landing form (VNX-0708). `referrer` is the external host the visitor came from. */
export type ClientSignup = Utm & { email: string; referrer: string | null };

export type WaitlistField = "email" | "consent";
export type WaitlistErrors = Partial<Record<WaitlistField, "invalid">>;

export type WaitlistFormResult =
  | { ok: true; entry: ClientSignup }
  /** The honeypot was filled: answer like a success, store nothing. */
  | { ok: false; spam: true }
  | { ok: false; spam: false; email: string; consent: boolean; errors: WaitlistErrors };

/** Optional text, trimmed, empty → null, cut to MAX_META. */
const meta = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().slice(0, MAX_META) : ""),
  z.string().transform((v) => (v === "" ? null : v)),
);

/** The `ref` hidden input: a hostname or null. Anything else (path, scheme, odd characters, too long) becomes null. */
const ref = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toLowerCase() : null),
  z.string().max(MAX_META).regex(HOSTNAME_RE).nullable().catch(null),
);

const Form = z.object({
  email: z.string().trim().toLowerCase().max(254).regex(WAITLIST_EMAIL_RE),
  consent: z.literal("on"),
  utm_source: meta,
  utm_medium: meta,
  utm_campaign: meta,
  ref,
});

/**
 * Hosts that count as this site, so they are never stored as a referrer: the APP_ORIGIN host, its www. form
 * (served until the www redirect, VNX-0804) and the host the request came in on (e.g. a preview).
 */
export function siteHosts(appOriginHost: string, requestHost: string): string[] {
  return [...new Set([appOriginHost, `www.${appOriginHost}`, requestHost])];
}

/** Reads utm_* from the landing page's query string (or a posted form) so the form can carry them in hidden inputs. */
export function utmFrom(values: Record<string, unknown>): Utm {
  const pick = (v: unknown) => meta.parse(v);
  return { utmSource: pick(values.utm_source), utmMedium: pick(values.utm_medium), utmCampaign: pick(values.utm_campaign) };
}

/** A posted `ref` value as a storable external host, or null. */
export function refHost(value: unknown, hosts: readonly string[]): string | null {
  const host = ref.parse(value);
  return host && !hosts.includes(host) ? host : null;
}

export function parseWaitlistForm(body: Record<string, unknown>, hosts: readonly string[]): WaitlistFormResult {
  // Real people never see the honeypot, so any value means a bot.
  if (typeof body.website === "string" && body.website.trim() !== "") return { ok: false, spam: true };

  const parsed = Form.safeParse(body);
  if (parsed.success) {
    const d = parsed.data;
    const referrer = d.ref && !hosts.includes(d.ref) ? d.ref : null;
    return { ok: true, entry: { email: d.email, utmSource: d.utm_source, utmMedium: d.utm_medium, utmCampaign: d.utm_campaign, referrer } };
  }
  const errors: WaitlistErrors = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (field === "email" || field === "consent") errors[field] = "invalid";
  }
  return { ok: false, spam: false, email: typeof body.email === "string" ? body.email.trim() : "", consent: body.consent === "on", errors };
}

/**
 * Host of the landing page's Referer header, kept only when it is another site (no path, so no search terms or
 * tokens are stored). Returns only values that `refHost` accepts back from the form.
 */
export function externalReferrerHost(referer: string | undefined, hosts: readonly string[]): string | null {
  if (!referer) return null;
  let url: URL;
  try {
    url = new URL(referer);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  return refHost(url.hostname, hosts);
}
