import { isPublicHostname, MAX_ALLOWED_HOSTS, validateFinalUrl, type UrlError } from "./offer-url.ts";
import { normalizeNewlines } from "./product-input.ts";
import { SLUG_RE } from "./slug.ts";

/** Merchants (addendum §3.2). Pure rules: no Hono, no D1. */

export const MERCHANT_STATUSES = ["active", "paused", "archived"] as const;
export type MerchantStatus = (typeof MERCHANT_STATUSES)[number];

/** Taken by /go/p/… and /go/o/…. */
export const RESERVED_MERCHANT_SLUGS: ReadonlySet<string> = new Set(["p", "o"]);
export const MERCHANT_NAME_MAX = 80;
export const MERCHANT_DESCRIPTION_MAX = 2000;

/** The product slug rule, plus the reserved words (checked first so the error says why). */
export function merchantSlugError(slug: string): "reserved" | "format" | null {
  if (RESERVED_MERCHANT_SLUGS.has(slug)) return "reserved";
  return SLUG_RE.test(slug) ? null : "format";
}

export type AllowedHostsError = "empty" | "too_many" | "format" | "duplicate";

/** Comma or line separated host names, lower-cased; same host format as the URL rules (`isPublicHostname`). */
export function parseAllowedHosts(raw: string): { ok: true; hosts: string[] } | { ok: false; error: AllowedHostsError } {
  const hosts = raw
    .toLowerCase()
    .split(/[\s,]+/)
    .filter((h) => h !== "");
  if (hosts.length === 0) return { ok: false, error: "empty" };
  if (hosts.length > MAX_ALLOWED_HOSTS) return { ok: false, error: "too_many" };
  if (!hosts.every((h) => isPublicHostname(h))) return { ok: false, error: "format" };
  if (new Set(hosts).size !== hosts.length) return { ok: false, error: "duplicate" };
  return { ok: true, hosts };
}

export type MerchantFormValues = { name: string; slug: string; websiteUrl: string; allowedHosts: string; description: string; indexable: boolean };
export type MerchantField = "name" | "slug" | "websiteUrl" | "allowedHosts" | "description";
export type MerchantFieldError = "required" | "too_long" | "format" | "reserved" | AllowedHostsError | `url_${UrlError}`;
export type MerchantInput = { name: string; slug: string; websiteUrl: string; allowedHosts: string[]; description: string; indexable: boolean };

export function parseMerchantForm(v: MerchantFormValues): { ok: true; merchant: MerchantInput } | { ok: false; errors: Partial<Record<MerchantField, MerchantFieldError>> } {
  const errors: Partial<Record<MerchantField, MerchantFieldError>> = {};
  const name = v.name.trim();
  if (name === "") errors.name = "required";
  else if (name.length > MERCHANT_NAME_MAX) errors.name = "too_long";

  const slug = v.slug.trim().toLowerCase();
  const slugError = merchantSlugError(slug);
  if (slugError) errors.slug = slugError;

  const description = normalizeNewlines(v.description).trim();
  if (description.length > MERCHANT_DESCRIPTION_MAX) errors.description = "too_long";

  const hosts = parseAllowedHosts(v.allowedHosts);
  let websiteUrl = "";
  if (!hosts.ok) {
    errors.allowedHosts = hosts.error;
  } else if (v.websiteUrl.trim() === "") {
    errors.websiteUrl = "required";
  } else {
    const url = validateFinalUrl(v.websiteUrl.trim(), hosts.hosts);
    if (url.ok) websiteUrl = url.url;
    else errors.websiteUrl = `url_${url.error}`;
  }

  if (!hosts.ok || Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, merchant: { name, slug, websiteUrl, allowedHosts: hosts.hosts, description, indexable: v.indexable } };
}

/** `archived` is terminal (Controller 2026-10-05); staying where it is is not a transition. Also enforced in db/merchants.ts#setMerchantStatus. */
export function merchantTransitionAllowed(from: MerchantStatus, to: MerchantStatus): boolean {
  return from === to || from !== "archived";
}

/** Shared-hosting suffixes: anyone can publish under them, so allowing one proves nothing about the merchant. A warning, not a rule. */
export const MULTI_TENANT_SUFFIXES = [
  "github.io",
  "vercel.app",
  "pages.dev",
  "netlify.app",
  "herokuapp.com",
  "workers.dev",
  "web.app",
  "firebaseapp.com",
  "azurewebsites.net",
  "cloudfront.net",
  "appspot.com",
  "blogspot.com",
  "onrender.com",
  "fly.dev",
  "r2.dev",
  "s3.amazonaws.com",
  "ngrok-free.app",
] as const;

/** The hosts that are a shared-hosting suffix or a subdomain of one (never a bare string suffix: `notgithub.io` is fine). */
export function multiTenantHosts(hosts: readonly string[]): string[] {
  return hosts.filter((h) => MULTI_TENANT_SUFFIXES.some((s) => h === s || h.endsWith(`.${s}`)));
}

/** True when the two allow-lists differ as sets. */
export function hostsChanged(a: readonly string[], b: readonly string[]): boolean {
  const left = [...a].sort();
  const right = [...b].sort();
  return left.length !== right.length || left.some((h, i) => h !== right[i]);
}
