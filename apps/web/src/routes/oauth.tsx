import type { Context, Hono } from "hono";
import { adminEmails } from "../auth/admin.ts";
import { readSessionCookie, writeSessionCookie } from "../auth/cookies.ts";
import { getOAuthProvider } from "../auth/oauth/index.ts";
import type { ExchangeFailure, ProviderClient } from "../auth/oauth/provider.ts";
import { clearOAuthCookie, linkSessionHash, readOAuthCookie, writeOAuthCookie } from "../auth/oauth-cookie.ts";
import { createSession } from "../auth/sessions.ts";
import { writeAudit } from "../db/audit.ts";
import { isFlagEnabled } from "../db/flags.ts";
import { findIdentityByProviderSubject, touchIdentityLogin } from "../db/identities.ts";
import { findUserById, markLogin } from "../db/users.ts";
import { isOAuthProvider, type OAuthProvider, PROVIDER_FLAG, sessionMethodFor } from "../domain/identity.ts";
import { buildAuthorizeUrl, checkCallbackState, codeChallengeS256, generateNonce, generateState, generateVerifier, newFlowCookie, oauthRedirectUri, resolveStartIntent } from "../domain/oauth.ts";
import type { AppEnv } from "../env.ts";
import { isLocale, type Locale, localeFromPath, localizedPath } from "../i18n/locales.ts";
import { safeNext } from "../http/next.ts";
import { hitRateLimit } from "../http/rate-limit.ts";
import { OAuthErrorPage, OAuthNotLinkedPage } from "../views/auth.tsx";
import { errorResponse } from "../views/error-response.tsx";
import { page } from "../views/render.ts";

const HOUR = 3600;
const MAX_CODE_CHARS = 2048;

/** The only things the callback ever logs (Review Focus 9): fixed codes, never a message, a URL or a provider reply. */
type OAuthFailure = "no_cookie" | "wrong_phase" | "state_mismatch" | "provider_denied" | "missing_code" | "link_unsupported" | "rate_limited" | "internal" | ExchangeFailure;

/**
 * The URL of start and callback carries `state` and (callback) the one-time `code`, and the callback decides who is signed in.
 * Nothing may be cached or sent in a Referer. `same-origin`, not `no-referrer` (VNX-0803 review F1).
 */
function harden(c: Context<AppEnv>) {
  c.header("Cache-Control", "no-store");
  c.header("Referrer-Policy", "same-origin");
}

/** The provider, when it exists, its flag is on and its credentials are set (decision 6); otherwise null and the caller answers 404. */
async function enabledProvider(c: Context<AppEnv>): Promise<{ provider: OAuthProvider; client: ProviderClient } | null> {
  const name = c.req.param("provider");
  if (!isOAuthProvider(name) || !(await isFlagEnabled(c.env.DB, PROVIDER_FLAG[name]))) return null;
  const client = getOAuthProvider(c.env, name);
  return client ? { provider: name, client } : null;
}

function failed(c: Context<AppEnv>, provider: OAuthProvider, code: OAuthFailure, locale: Locale = "en", status: 400 | 429 = 400, event: "oauth.callback_failed" | "oauth.start_failed" = "oauth.callback_failed") {
  console.error(JSON.stringify({ requestId: c.get("requestId"), event, provider, code }));
  return page(c, <OAuthErrorPage locale={locale} origin={new URL(c.req.url).origin} />, status);
}

export function registerOAuthRoutes(app: Hono<AppEnv>) {
  app.get("/auth/oauth/:provider/start", async (c) => {
    harden(c);
    const found = await enabledProvider(c);
    if (!found) return errorResponse(c, "notFound", 404);
    const { provider, client } = found;
    const now = Date.now();
    // Task 2 LOW-2: a link intent counts only for a session that is alive now (`user` is null for an expired or suspended one).
    const raw = readSessionCookie(c);
    const sessionHash = c.get("user") && raw ? await linkSessionHash(raw) : null;
    if (resolveStartIntent(readOAuthCookie(c, provider, now), sessionHash, now) === "link") {
      // Task 8 replaces this branch with the intermediate page (decision 14).
      clearOAuthCookie(c);
      return failed(c, provider, "link_unsupported", "en", 400, "oauth.start_failed");
    }
    const next = safeNext(c.req.query("next"));
    const lang = c.req.query("lang");
    const locale = isLocale(lang) ? lang : localeFromPath(next ?? "/").locale;
    const state = generateState();
    const verifier = generateVerifier();
    const nonce = generateNonce();
    writeOAuthCookie(c, newFlowCookie({ provider, intent: "signin", state, verifier, nonce, next, locale, sessionHash: null }, now), now);
    const url = buildAuthorizeUrl({ provider, clientId: client.clientId, redirectUri: oauthRedirectUri(c.env.APP_ORIGIN, provider), state, challenge: await codeChallengeS256(verifier), nonce });
    return c.redirect(url, 302);
  });

  app.get("/auth/oauth/:provider/callback", async (c) => {
    harden(c);
    // Used once, on every path (Review Focus 1): the request still carries the cookie; only the response deletes it.
    clearOAuthCookie(c);
    const found = await enabledProvider(c);
    if (!found) return errorResponse(c, "notFound", 404);
    const { provider, client } = found;
    const nowMs = Date.now();
    try {
      const ip = c.req.header("cf-connecting-ip") ?? "unknown";
      if (!(await hitRateLimit(c.env.DB, `oauth:ip:${ip}`, 20, HOUR, nowMs)).allowed) return await failed(c, provider, "rate_limited", "en", 429);

      // `readOAuthCookie` returns null for a cookie written for another provider (F5).
      const check = checkCallbackState(readOAuthCookie(c, provider, nowMs), c.req.query("state"));
      if (!check.ok) return await failed(c, provider, check.reason);
      const { flow } = check;
      // Task 8 adds the link branch; until then nothing but a sign-in is accepted.
      if (flow.intent !== "signin") return await failed(c, provider, "link_unsupported", flow.locale);

      const code = c.req.query("code");
      if (c.req.query("error") !== undefined) return await failed(c, provider, "provider_denied", flow.locale);
      if (!code || code.length > MAX_CODE_CHARS) return await failed(c, provider, "missing_code", flow.locale);

      // One redirect URI, from APP_ORIGIN, for authorize (start) and for exchange: never from this request's URL.
      const result = await client.exchange({ code, verifier: flow.verifier, nonce: flow.nonce, redirectUri: oauthRedirectUri(c.env.APP_ORIGIN, provider), now: nowMs });
      if (!result.ok) return await failed(c, provider, result.reason, flow.locale);

      // Not linked: no account, no session, no look at any e-mail (ADR-012 §3.2, decision 12). The same page for every case.
      const identity = await findIdentityByProviderSubject(c.env.DB, provider, result.identity.subject);
      if (!identity) return await page(c, <OAuthNotLinkedPage locale={flow.locale} origin={new URL(c.req.url).origin} />);
      const user = await findUserById(c.env.DB, identity.userId);
      if (!user || user.status !== "active") return await errorResponse(c, "forbidden", 403);

      const now = new Date(nowMs);
      const iso = now.toISOString();
      const method = sessionMethodFor(provider);
      await markLogin(c.env.DB, user.id, { now: iso, isAdmin: adminEmails(c.env).has(user.email) });
      await writeAudit(c.env.DB, { actorUserId: user.id, action: "auth.login", entity: "user", entityId: user.id, data: { method }, now: iso });
      await touchIdentityLogin(c.env.DB, { id: identity.id, label: result.identity.label, now: iso });
      writeSessionCookie(c, await createSession(c.env.DB, user.id, now, method));
      return c.redirect(safeNext(flow.next) ?? localizedPath(flow.locale, "/"), 303);
    } catch {
      // No `err` is bound on purpose: nothing about it can reach a log (F5).
      return await failed(c, provider, "internal");
    }
  });
}
