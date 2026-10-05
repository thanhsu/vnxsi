/**
 * Rules for every outbound URL (ADR-007 rule 7, plan header "Global Constraints"). Pure: no Hono, no D1, no I/O.
 * The same function runs when an admin saves (sample values) and on every redirect (real values).
 */

export const MAX_URL_LENGTH = 2048;
export const MAX_ALLOWED_HOSTS = 20;
export const PLACEHOLDERS = ["click_id", "locale", "src"] as const;
export type Placeholder = (typeof PLACEHOLDERS)[number];
export type TemplateValues = Record<Placeholder, string>;
/** Values filled in when an admin saves or previews a template. */
export const SAMPLE_VALUES: TemplateValues = { click_id: "01HZZZZZZZZZZZZZZZZZZZZZZZ", locale: "en", src: "tools" };

export type UrlError = "length" | "chars" | "scheme" | "authority" | "parse" | "userinfo" | "port" | "host" | "not_allowed";
export type UrlResult = { ok: true; url: string } | { ok: false; error: UrlError };

const SCHEME = "https://";
const LABEL = "[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?";
const HOSTNAME_RE = new RegExp(`^(?:${LABEL}\\.)+${LABEL}$`);

/** Printable ASCII only (no space, control or non-ASCII such as fullwidth letters or U+3002), and no backslash. */
export function isPrintableAscii(raw: string): boolean {
  return /^[\x21-\x7E]+$/.test(raw) && !raw.includes("\\");
}

/** Exactly lowercase `https://`; `https:evil.com`, `HTTPS://` and `//evil.com` fail. */
export function hasHttpsPrefix(raw: string): boolean {
  return raw.startsWith(SCHEME);
}

/** Text after `https://` up to the first `/`, `?` or `#`. */
export function authorityOf(raw: string): string {
  return raw.slice(SCHEME.length).split(/[/?#]/, 1)[0] ?? "";
}

/** Not empty, and no userinfo (`@`), percent escape (`%2e`) or placeholder brace in it. */
export function isAuthorityClean(authority: string): boolean {
  return authority !== "" && !/[@%{}]/.test(authority);
}

/** After WHATWG parsing: no userinfo; port is empty (the parser drops `:443`, so `:8443` is the only way to a port). */
export function originError(url: URL): "userinfo" | "port" | null {
  if (url.username !== "" || url.password !== "") return "userinfo";
  return url.port === "" ? null : "port";
}

/**
 * A name with at least two LDH labels whose last label has a letter. That rejects IPv4 in every form (decimal, merged,
 * hex, octal all parse to dotted numbers), IPv6 literals, a trailing dot, `localhost` and `*.localhost`. Also the format of allowed_hosts.
 */
export function isPublicHostname(hostname: string): boolean {
  if (hostname.startsWith("[") || hostname.endsWith(".")) return false;
  if (hostname === "localhost" || hostname.endsWith(".localhost") || !hostname.includes(".")) return false;
  if (!/[a-z]/.test(hostname.slice(hostname.lastIndexOf(".") + 1))) return false;
  return hostname.length <= 253 && HOSTNAME_RE.test(hostname);
}

/** Exact match or a subdomain of an allowed host; never a bare string suffix (`evilexample.com` vs `example.com`). */
export function hostAllowed(hostname: string, allowed: readonly string[]): boolean {
  return allowed.some((h) => hostname === h || hostname.endsWith(`.${h}`));
}

function check(raw: string, allowed: readonly string[]): UrlResult {
  const fail = (error: UrlError): UrlResult => ({ ok: false, error });
  if (raw.length > MAX_URL_LENGTH) return fail("length");
  if (!isPrintableAscii(raw)) return fail("chars");
  if (!hasHttpsPrefix(raw)) return fail("scheme");
  if (!isAuthorityClean(authorityOf(raw))) return fail("authority");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return fail("parse");
  }
  if (url.protocol !== "https:") return fail("parse");
  const origin = originError(url);
  if (origin) return fail(origin);
  if (!isPublicHostname(url.hostname)) return fail("host");
  if (!hostAllowed(url.hostname, allowed)) return fail("not_allowed");
  return { ok: true, url: url.href };
}

/**
 * The one gate for destination_url, website_url, a filled template and every redirect. On success `url` is `new URL(raw).href`,
 * checked again: the value a route puts in `Location` is this, never the raw string.
 */
export function validateFinalUrl(raw: string, allowed: readonly string[]): UrlResult {
  const first = check(raw, allowed);
  if (!first.ok) return first;
  const second = check(first.url, allowed);
  return second.ok && second.url === first.url ? second : { ok: false, error: "parse" };
}

export type TemplateError = "braces" | "placeholder" | "placeholder_position";

/** Names inside `{...}`, or null when a `{` or `}` is left over (odd or nested). */
export function placeholderNames(raw: string): string[] | null {
  const names = [...raw.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1] ?? "");
  return /[{}]/.test(raw.replace(/\{[^{}]*\}/g, "")) ? null : names;
}

export function fillTemplate(template: string, values: TemplateValues): string {
  return template.replace(/\{(click_id|locale|src)\}/g, (_m, name: Placeholder) => encodeURIComponent(values[name]));
}

/** Fill (encoded) then validate. Used with sample values at save and with real values at redirect. */
export function fillAndValidate(template: string, values: TemplateValues, allowed: readonly string[]): UrlResult {
  let filled: string;
  try {
    filled = fillTemplate(template, values);
  } catch {
    return { ok: false, error: "chars" };
  }
  // A { or } still there means an unknown or odd placeholder reached a redirect: refuse it.
  if (/[{}]/.test(filled)) return { ok: false, error: "chars" };
  return validateFinalUrl(filled, allowed);
}

export const previewUrl = (template: string, allowed: readonly string[]): UrlResult => fillAndValidate(template, SAMPLE_VALUES, allowed);

// Everything before the first `{` must be scheme + host (+ one of / ? #), so a placeholder is never in the scheme, host, port or userinfo.
const TEMPLATE_PREFIX_RE = /^https:\/\/[^/?#@{}\\]+[/?#]/;

export function parseTemplate(raw: string, allowed: readonly string[]): { ok: true; template: string } | { ok: false; error: TemplateError | UrlError } {
  const names = placeholderNames(raw);
  if (names === null) return { ok: false, error: "braces" };
  if (names.some((n) => !(PLACEHOLDERS as readonly string[]).includes(n))) return { ok: false, error: "placeholder" };
  if (names.length > 0 && !TEMPLATE_PREFIX_RE.test(raw.slice(0, raw.indexOf("{")))) return { ok: false, error: "placeholder_position" };
  const sample = previewUrl(raw, allowed);
  return sample.ok ? { ok: true, template: raw } : { ok: false, error: sample.error };
}

/** `utm_source=vnx.si&utm_medium=referral`, unless the URL already has any utm_* parameter. Existing query text is kept byte for byte. */
export function appendUtm(url: string): string {
  const u = new URL(url);
  if ([...u.searchParams.keys()].some((k) => k.toLowerCase().startsWith("utm_"))) return url;
  u.search = `${u.search === "" ? "?" : `${u.search}&`}utm_source=vnx.si&utm_medium=referral`;
  return u.href;
}
