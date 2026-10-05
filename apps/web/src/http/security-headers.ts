import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../env.ts";

/**
 * Review VNX-0803 F2. Allow-list CSP: the pages carry no inline script (JSON-LD is a data block, never executed) and no
 * inline style; Turnstile needs only its script and frame origin
 * (https://developers.cloudflare.com/turnstile/reference/content-security-policy/). `form-action 'self'` also covers the
 * redirect after a POST in Chrome, so a POST handler must never redirect off-site.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
  "style-src 'self'",
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export const SECURITY_HEADERS: ReadonlyArray<readonly [string, string]> = [
  ["Content-Security-Policy", CONTENT_SECURITY_POLICY],
  // Legacy twin of frame-ancestors for browsers without CSP level 2.
  ["X-Frame-Options", "DENY"],
  ["X-Content-Type-Options", "nosniff"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  ["Permissions-Policy", "camera=(), microphone=(), geolocation=()"],
  // One year, this host only (no includeSubDomains until every subdomain is known to serve HTTPS).
  ["Strict-Transport-Security", "max-age=31536000"],
];

/**
 * Adds each header unless the route already set it, so /join and /auth/verify keep their stricter Referrer-Policy.
 * Runs after the handler: c.header() on a finalized response makes Hono clone it, which also covers responses built
 * outside Hono (ASSETS.fetch, /media/*), whose headers are immutable.
 */
export const securityHeaders: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();
  for (const [name, value] of SECURITY_HEADERS) {
    if (!c.res.headers.has(name)) c.header(name, value);
  }
};
