import { isLocale, type Locale } from "../i18n/locales.ts";
import type { OAuthProvider } from "./identity.ts";

/**
 * The OAuth core (ADR-012 §1; VNX-2603a). Pure: no Hono, no database, no I/O; WebCrypto only. It never sees a token endpoint,
 * a secret or an access token: the ID token claims it checks come from the adapter (Task 3), which got them from the
 * token endpoint over TLS (decision 3).
 */

export type OAuthIntent = "signin" | "link";

/** Lifetime of the sign-in cookie (ADR-012 §1) and of the short "link" intent a POST leaves for the start route (decision 4). */
export const OAUTH_FLOW_TTL_MS = 600_000;
export const LINK_INTENT_TTL_MS = 120_000;
/** Clock tolerance on `exp` (decision 3 (d)). */
const EXP_SKEW_SECONDS = 60;
const MAX_COOKIE_CHARS = 2048;
const MAX_NEXT_CHARS = 512;

export interface OAuthProviderSpec {
  authorizeUrl: string;
  /** Space-separated; empty means the parameter is left out (GitHub asks for no scope). */
  scope: string;
  /** OpenID Connect: adds `nonce` and an ID token to check. GitHub is plain OAuth 2.0. */
  oidc: boolean;
  /** Exact `iss` values accepted (decision 3 (c)). */
  issuers: readonly string[];
}

export const OAUTH_PROVIDER_SPECS: Record<OAuthProvider, OAuthProviderSpec> = {
  google: { authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth", scope: "openid email", oidc: true, issuers: ["https://accounts.google.com", "accounts.google.com"] },
  github: { authorizeUrl: "https://github.com/login/oauth/authorize", scope: "", oidc: false, issuers: [] },
  linkedin: { authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization", scope: "openid profile email", oidc: true, issuers: ["https://www.linkedin.com/oauth"] },
};

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Null for anything outside the base64url alphabet or of an impossible length. */
export function base64UrlDecode(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  try {
    const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(text.length / 4) * 4, "="));
    return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  } catch {
    return null;
  }
}

/**
 * Constant-time equality of two strings (decision 2, R2). workerd's `timingSafeEqual` throws on different lengths; the
 * lengths of state, nonce and hashes are public, so a length mismatch returns false without comparing.
 */
export function timingSafeEqualText(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  return x.length === y.length && crypto.subtle.timingSafeEqual(x, y);
}

/** 32 random bytes as 43 base64url characters: a valid RFC 7636 verifier and a state or nonce with 256 bits of entropy. */
function randomValue(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
}
export const generateState = randomValue;
export const generateNonce = randomValue;
export const generateVerifier = randomValue;

/** RFC 7636 §4.2 `S256`: BASE64URL(SHA-256(verifier)). */
export async function codeChallengeS256(verifier: string): Promise<string> {
  return base64UrlEncode(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
}

/** The fixed callback address (ADR-012 §1): no locale prefix, built from APP_ORIGIN and the provider only. */
export function oauthRedirectUri(appOrigin: string, provider: OAuthProvider): string {
  return new URL(`/auth/oauth/${provider}/callback`, appOrigin).toString();
}

/** Joins only the known parameters; nothing from a request reaches it except the values the caller generated. */
export function buildAuthorizeUrl(input: { provider: OAuthProvider; clientId: string; redirectUri: string; state: string; challenge: string; nonce: string }): string {
  const spec = OAUTH_PROVIDER_SPECS[input.provider];
  const url = new URL(spec.authorizeUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  if (spec.scope) url.searchParams.set("scope", spec.scope);
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (spec.oidc) url.searchParams.set("nonce", input.nonce);
  return url.toString();
}

export type IdTokenFailure = "malformed" | "issuer" | "audience" | "azp" | "expired" | "nonce" | "subject";
export type IdTokenResult = { ok: true; claims: { subject: string; email: string | null } } | { ok: false; reason: IdTokenFailure };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Checks the claims of an ID token the adapter received from the token endpoint (decision 3 (c), (d)). It does NOT verify the
 * signature: OIDC Core §3.1.3.7 item 6 allows that for a token received directly from the token endpoint over TLS (approved
 * roadmap deviation R1). Fails closed: an empty expected client id or nonce is `malformed`. Returns the subject and the e-mail
 * only: the name is never read (F2).
 */
export function verifyIdToken(idToken: string, expected: { issuers: readonly string[]; audience: string; nonce: string; now: number }): IdTokenResult {
  const fail = (reason: IdTokenFailure): IdTokenResult => ({ ok: false, reason });
  if (!expected.audience || !expected.nonce) return fail("malformed");
  const parts = idToken.split(".");
  if (parts.length !== 3) return fail("malformed");
  const bytes = base64UrlDecode(parts[1] ?? "");
  if (!bytes) return fail("malformed");
  let claims: unknown;
  try {
    claims = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return fail("malformed");
  }
  if (!isRecord(claims)) return fail("malformed");

  if (typeof claims.iss !== "string" || !expected.issuers.includes(claims.iss)) return fail("issuer");
  const audiences = typeof claims.aud === "string" ? [claims.aud] : Array.isArray(claims.aud) ? claims.aud : [];
  if (!audiences.includes(expected.audience)) return fail("audience");
  // OIDC Core §2: with several audiences azp is required; whenever it is present it must be this client.
  if (claims.azp !== undefined ? claims.azp !== expected.audience : audiences.length > 1) return fail("azp");
  if (typeof claims.exp !== "number" || !Number.isFinite(claims.exp) || claims.exp + EXP_SKEW_SECONDS <= expected.now / 1000) return fail("expired");
  if (typeof claims.nonce !== "string" || !timingSafeEqualText(claims.nonce, expected.nonce)) return fail("nonce");
  if (typeof claims.sub !== "string" || claims.sub.length < 1 || claims.sub.length > 255) return fail("subject");
  const email = typeof claims.email === "string" && claims.email.length >= 1 && claims.email.length <= 254 ? claims.email : null;
  return { ok: true, claims: { subject: claims.sub, email } };
}

/** Left by `POST …/link` for the start route: "this signed-in session asked to link this provider". */
export interface LinkIntentCookie {
  v: 1;
  phase: "intent";
  provider: OAuthProvider;
  intent: "link";
  /** `sha256("oauth-link:" + raw session id)`, never the session's own `id_hash` (S1). */
  sessionHash: string;
  /** Epoch milliseconds. */
  exp: number;
}

/** Written by the start route; the callback accepts only this phase. */
export interface FlowCookie {
  v: 1;
  phase: "flow";
  provider: OAuthProvider;
  intent: OAuthIntent;
  state: string;
  verifier: string;
  nonce: string;
  /** A same-site path the route already ran through `safeNext`, or null. */
  next: string | null;
  locale: Locale;
  /** Set for `link` (the session that asked), null for `signin`. */
  sessionHash: string | null;
  exp: number;
}

export type OAuthCookie = LinkIntentCookie | FlowCookie;

export function newLinkIntent(input: { provider: OAuthProvider; sessionHash: string }, now: number): LinkIntentCookie {
  return { v: 1, phase: "intent", provider: input.provider, intent: "link", sessionHash: input.sessionHash, exp: now + LINK_INTENT_TTL_MS };
}

/** One rule for `next` in a cookie, used on write and on parse: a same-site path of printable ASCII, not protocol-relative, within the length cap. */
export function isSafeCookieNext(next: string): boolean {
  return next.length <= MAX_NEXT_CHARS && /^[\x20-\x7e]+$/.test(next) && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\");
}

export function newFlowCookie(
  input: { provider: OAuthProvider; intent: OAuthIntent; state: string; verifier: string; nonce: string; next: string | null; locale: Locale; sessionHash: string | null },
  now: number,
): FlowCookie {
  if ((input.intent === "link") !== (input.sessionHash !== null)) throw new Error("a link flow needs a session hash, a signin flow must not have one");
  const next = input.next !== null && isSafeCookieNext(input.next) ? input.next : null;
  return { v: 1, phase: "flow", ...input, next, exp: now + OAUTH_FLOW_TTL_MS };
}

export function encodeOAuthCookie(cookie: OAuthCookie): string {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(cookie)));
}

const TOKEN = /^[A-Za-z0-9_-]{43,128}$/;
const HASH = /^[0-9a-f]{64}$/;

/**
 * The cookie is not signed (decision 4), so everything is checked: shape, lengths, the provider it was written for (F5: the
 * callback passes the `:provider` of its URL), expiry, and that `exp` is no further away than the phase's lifetime. Every defect
 * gives the same null.
 */
export function parseOAuthCookie(raw: string | null | undefined, expected: { provider: OAuthProvider; now: number }): OAuthCookie | null {
  if (!raw || raw.length > MAX_COOKIE_CHARS) return null;
  const bytes = base64UrlDecode(raw);
  if (!bytes) return null;
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
  if (!isRecord(value) || value.v !== 1 || value.provider !== expected.provider) return null;
  const exp = value.exp;
  if (typeof exp !== "number" || !Number.isFinite(exp) || exp <= expected.now) return null;

  if (value.phase === "intent") {
    if (value.intent !== "link" || typeof value.sessionHash !== "string" || !HASH.test(value.sessionHash) || exp - expected.now > LINK_INTENT_TTL_MS) return null;
    return { v: 1, phase: "intent", provider: expected.provider, intent: "link", sessionHash: value.sessionHash, exp };
  }
  if (value.phase !== "flow" || exp - expected.now > OAUTH_FLOW_TTL_MS) return null;
  const { intent, state, verifier, nonce, next, locale, sessionHash } = value;
  if (intent !== "signin" && intent !== "link") return null;
  if (typeof state !== "string" || !TOKEN.test(state) || typeof verifier !== "string" || !TOKEN.test(verifier) || typeof nonce !== "string" || !TOKEN.test(nonce)) return null;
  if (next !== null && (typeof next !== "string" || !isSafeCookieNext(next))) return null;
  if (!isLocale(locale)) return null;
  if (intent === "link" ? typeof sessionHash !== "string" || !HASH.test(sessionHash) : sessionHash !== null) return null;
  return { v: 1, phase: "flow", provider: expected.provider, intent, state, verifier, nonce, next, locale, sessionHash: sessionHash as string | null, exp };
}

/**
 * The start route's choice (decision 4): "link" only for a live intent cookie whose session hash equals the hash of the session
 * making this request; anything else, a flow cookie included, is a plain sign-in. No URL parameter ever chooses the intent.
 */
export function resolveStartIntent(cookie: OAuthCookie | null, sessionHash: string | null, now: number): OAuthIntent {
  if (!cookie || cookie.phase !== "intent" || sessionHash === null || cookie.exp <= now) return "signin";
  return timingSafeEqualText(cookie.sessionHash, sessionHash) ? "link" : "signin";
}

export type CallbackCheck = { ok: true; flow: FlowCookie } | { ok: false; reason: "no_cookie" | "wrong_phase" | "state_mismatch" };

/** The callback's first gate: a flow cookie (already matched to `:provider` and unexpired by the parser) and the same `state`. */
export function checkCallbackState(cookie: OAuthCookie | null, stateParam: string | null | undefined): CallbackCheck {
  if (!cookie) return { ok: false, reason: "no_cookie" };
  if (cookie.phase !== "flow") return { ok: false, reason: "wrong_phase" };
  if (!stateParam || !timingSafeEqualText(cookie.state, stateParam)) return { ok: false, reason: "state_mismatch" };
  return { ok: true, flow: cookie };
}

/** A signin flow needs no session; a link flow is valid only for the session that asked for it. */
export function flowMatchesSession(flow: FlowCookie, sessionHash: string | null): boolean {
  return flow.intent === "signin" || (flow.sessionHash !== null && sessionHash !== null && timingSafeEqualText(flow.sessionHash, sessionHash));
}
