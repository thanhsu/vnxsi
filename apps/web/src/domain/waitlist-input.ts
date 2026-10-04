import { z } from "zod";

/** Same check as the pre-pivot landing form (spec §5.8), kept so earlier entries stay comparable. */
export const WAITLIST_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** utm_* and the referrer host are stored at most this long. */
export const MAX_META = 200;

export type Utm = { utmSource: string | null; utmMedium: string | null; utmCampaign: string | null };

/** One client signup from the landing form (VNX-0708). */
export type ClientSignup = Utm & { email: string };

export type WaitlistField = "email" | "consent";
export type WaitlistErrors = Partial<Record<WaitlistField, "invalid">>;

export type WaitlistFormResult =
  | { ok: true; entry: ClientSignup }
  /** The honeypot was filled: answer like a success, store nothing. */
  | { ok: false; spam: true }
  | { ok: false; spam: false; email: string; errors: WaitlistErrors };

/** Optional text, trimmed, empty → null, cut to MAX_META. */
const meta = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().slice(0, MAX_META) : ""),
  z.string().transform((v) => (v === "" ? null : v)),
);

const Form = z.object({
  email: z.string().trim().toLowerCase().max(254).regex(WAITLIST_EMAIL_RE),
  consent: z.literal("on"),
  utm_source: meta,
  utm_medium: meta,
  utm_campaign: meta,
});

/** Reads utm_* from the landing page's query string (or a posted form) so the form can carry them in hidden inputs. */
export function utmFrom(values: Record<string, unknown>): Utm {
  const pick = (v: unknown) => meta.parse(v);
  return { utmSource: pick(values.utm_source), utmMedium: pick(values.utm_medium), utmCampaign: pick(values.utm_campaign) };
}

export function parseWaitlistForm(body: Record<string, unknown>): WaitlistFormResult {
  // Real people never see the honeypot, so any value means a bot.
  if (typeof body.website === "string" && body.website.trim() !== "") return { ok: false, spam: true };

  const parsed = Form.safeParse(body);
  if (parsed.success) {
    const d = parsed.data;
    return { ok: true, entry: { email: d.email, utmSource: d.utm_source, utmMedium: d.utm_medium, utmCampaign: d.utm_campaign } };
  }
  const errors: WaitlistErrors = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (field === "email" || field === "consent") errors[field] = "invalid";
  }
  return { ok: false, spam: false, email: typeof body.email === "string" ? body.email.trim() : "", errors };
}

/**
 * Host of the Referer header, kept only when it is another site (no path, so no search terms or tokens are stored).
 * `siteHosts` are the hosts that count as this site.
 */
export function externalReferrerHost(referer: string | undefined, siteHosts: readonly string[]): string | null {
  if (!referer) return null;
  let url: URL;
  try {
    url = new URL(referer);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname;
  if (!host || siteHosts.includes(host)) return null;
  return host.slice(0, MAX_META);
}
