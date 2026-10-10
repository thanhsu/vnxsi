import type { Context, Hono } from "hono";
import { adminEmails } from "../auth/admin.ts";
import { sha256Hex } from "../auth/crypto.ts";
import { readSessionCookie, writeSessionCookie } from "../auth/cookies.ts";
import { getOAuthProvider, isProviderConfigured } from "../auth/oauth/index.ts";
import type { ExchangeFailure, ProviderClient } from "../auth/oauth/provider.ts";
import { clearOAuthCookie, linkSessionHash, readOAuthCookie, writeOAuthCookie } from "../auth/oauth-cookie.ts";
import { createSession, deleteSession } from "../auth/sessions.ts";
import { writeAudit } from "../db/audit.ts";
import { isFlagEnabled } from "../db/flags.ts";
import { findIdentityByProviderSubject, linkIdentity, touchIdentityLogin } from "../db/identities.ts";
import { notifyIdentityChange } from "../notify/identity.ts";
import { findUserById, markLogin } from "../db/users.ts";
import { isLinkCapableSession, isOAuthProvider, OAUTH_PROVIDERS, type OAuthProvider, PROVIDER_FLAG, sessionMethodFor } from "../domain/identity.ts";
import { buildAuthorizeUrl, checkCallbackState, codeChallengeS256, generateNonce, generateState, generateVerifier, flowMatchesSession, newFlowCookie, oauthRedirectUri, resolveStartIntent, type FlowCookie } from "../domain/oauth.ts";
import type { AppEnv } from "../env.ts";
import { isLocale, type Locale, localeFromPath, localizedPath } from "../i18n/locales.ts";
import { safeNext } from "../http/next.ts";
import { hitRateLimit } from "../http/rate-limit.ts";
import { OAuthErrorPage, OAuthLinkPage, OAuthNotLinkedPage } from "../views/auth.tsx";
import type { LinkNotice } from "../views/me/LinkedAccounts.tsx";
import { errorResponse } from "../views/error-response.tsx";
import { page } from "../views/render.ts";

const HOUR = 3600;
const MAX_CODE_CHARS = 2048;

/** The only things the callback ever logs (Review Focus 9): fixed codes, never a message, a URL or a provider reply. */
type OAuthFailure = "no_cookie" | "wrong_phase" | "state_mismatch" | "provider_denied" | "missing_code" | "session_mismatch" | "link_conflict" | "rate_limited" | "user_inactive" | "internal" | ExchangeFailure;

/**
 * The URL of start and callback carries `state` and (callback) the one-time `code`, and the callback decides who is signed in.
 * Nothing may be cached or sent in a Referer. `same-origin`, not `no-referrer` (VNX-0803 review F1).
 */
function harden(c: Context<AppEnv>) {
  c.header("Cache-Control", "no-store");
  c.header("Referrer-Policy", "same-origin");
}

/** The provider, when it exists, its flag is on and its credentials are set (decision 6); otherwise null and the caller answers 404. */
export async function enabledProvider(c: Context<AppEnv>): Promise<{ provider: OAuthProvider; client: ProviderClient } | null> {
  const name = c.req.param("provider");
  if (!isOAuthProvider(name) || !(await isFlagEnabled(c.env.DB, PROVIDER_FLAG[name]))) return null;
  const client = getOAuthProvider(c.env, name);
  return client ? { provider: name, client } : null;
}

/** The providers a person may use right now: flag on AND configured (decision 6). `/login` and `/me` both ask this. */
export async function availableProviders(c: Context<AppEnv>): Promise<OAuthProvider[]> {
  const shown: OAuthProvider[] = [];
  for (const provider of OAUTH_PROVIDERS) {
    if ((await isFlagEnabled(c.env.DB, PROVIDER_FLAG[provider])) && isProviderConfigured(c.env, provider)) shown.push(provider);
  }
  return shown;
}

function logFailure(c: Context<AppEnv>, provider: OAuthProvider, code: OAuthFailure) {
  console.error(JSON.stringify({ requestId: c.get("requestId"), event: "oauth.callback_failed", provider, code }));
}

function failed(c: Context<AppEnv>, provider: OAuthProvider, code: OAuthFailure, locale: Locale = "en", status: 400 | 429 = 400) {
  logFailure(c, provider, code);
  return page(c, <OAuthErrorPage locale={locale} origin={new URL(c.req.url).origin} />, status);
}

/** Back to the owner's page with one fixed word; `/me` shows the message for it. The URL carries no code, state or id. */
const backToMe = (c: Context<AppEnv>, locale: Locale, notice: LinkNotice) => c.redirect(`${localizedPath(locale, "/me")}?link=${notice}`, 303);

/**
 * The `link` flow of the callback (ADR-012 §4). It needs the session that asked, checked BEFORE the code is spent, and attaches the
 * provider account to THAT user and nothing else (checked BEFORE the code is spent and again inside the write, ADR-013): no session is created or changed, no one is signed in, no e-mail is compared.
 */
async function finishLink(c: Context<AppEnv>, input: { provider: OAuthProvider; client: ProviderClient; flow: FlowCookie; nowMs: number }) {
  const { provider, client, flow, nowMs } = input;
  const user = c.get("user");
  const raw = readSessionCookie(c);
  // `user` is null for an expired or suspended session (Task 2 LOW-2). ADR-013, before the code is spent: a live magic-link session, and the one that asked.
  if (!user || !raw || !isLinkCapableSession(user.method) || !flowMatchesSession(flow, await linkSessionHash(raw))) return failed(c, provider, "session_mismatch", flow.locale);

  const code = c.req.query("code");
  if (c.req.query("error") !== undefined) {
    logFailure(c, provider, "provider_denied");
    return backToMe(c, flow.locale, "failed");
  }
  if (!code || code.length > MAX_CODE_CHARS) {
    logFailure(c, provider, "missing_code");
    return backToMe(c, flow.locale, "failed");
  }
  const result = await client.exchange({ code, verifier: flow.verifier, nonce: flow.nonce, redirectUri: oauthRedirectUri(c.env.APP_ORIGIN, provider), now: nowMs });
  if (!result.ok) {
    logFailure(c, provider, result.reason);
    return backToMe(c, flow.locale, "failed");
  }

  // After the exchange, the same check INSIDE the write (a session ended meanwhile writes nothing): `requireSession`.
  const nowIso = new Date(nowMs).toISOString();
  const linked = await linkIdentity(c.env.DB, { userId: user.id, provider, subject: result.identity.subject, label: result.identity.label, now: nowIso, requireSession: { idHash: await sha256Hex(raw) } });
  if (!linked.ok && linked.reason === "session_ended") return failed(c, provider, "session_mismatch", flow.locale); // not /me?link=failed: with no session /me would bounce to /login and lose the message
  // Only a real new link is told to the owner (not `already_linked`: nothing changed, and a replayed callback must not mail). The send never undoes the link.
  if (linked.ok) await notifyIdentityChange(c.env, { kind: "linked", to: user.email, locale: user.locale, provider, label: linked.identity.label, at: linked.identity.linkedAt, requestId: c.get("requestId") });
  if (linked.ok || linked.reason === "already_linked") return backToMe(c, flow.locale, "ok");
  logFailure(c, provider, "link_conflict");
  return backToMe(c, flow.locale, linked.reason === "user_has_provider" ? "hasProvider" : "taken");
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
    const user = c.get("user");
    const sessionHash = user && raw && isLinkCapableSession(user.method) ? await linkSessionHash(raw) : null; // ADR-013: any other session is, for linking, no session: a plain sign-in follows
    // An intent from POST …/link, or (MEDIUM-2) a live LINK flow of this very session (Back, refresh). Check `intent === "link"`
    // explicitly: `flowMatchesSession` is true for every signin flow.
    const cookie = readOAuthCookie(c, provider, now);
    const linking = sessionHash !== null && (resolveStartIntent(cookie, sessionHash, now) === "link" || (cookie?.phase === "flow" && cookie.intent === "link" && flowMatchesSession(cookie, sessionHash)));
    const next = linking ? null : safeNext(c.req.query("next"));
    const lang = c.req.query("lang");
    const locale = isLocale(lang) ? lang : localeFromPath(next ?? "/").locale;
    const state = generateState();
    const verifier = generateVerifier();
    const nonce = generateNonce();
    writeOAuthCookie(c, newFlowCookie({ provider, intent: linking ? "link" : "signin", state, verifier, nonce, next, locale, sessionHash: linking ? sessionHash : null }, now), now);
    const url = buildAuthorizeUrl({ provider, clientId: client.clientId, redirectUri: oauthRedirectUri(c.env.APP_ORIGIN, provider), state, challenge: await codeChallengeS256(verifier), nonce });
    // Decision 14 (R3): a link NEVER redirects. `form-action 'self'` covers the redirect chain of the POST that led here in Chrome;
    // clicking this link is a new navigation. The flow cookie replaces the intent cookie (one use).
    if (linking) return page(c, <OAuthLinkPage locale={locale} origin={new URL(c.req.url).origin} provider={provider} authorizeUrl={url} />);
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
      if (flow.intent === "link") return await finishLink(c, { provider, client, flow, nowMs });

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
      if (!user || user.status !== "active") {
        logFailure(c, provider, "user_inactive");
        return await errorResponse(c, "forbidden", 403);
      }

      const now = new Date(nowMs);
      const iso = now.toISOString();
      const method = sessionMethodFor(provider);
      await markLogin(c.env.DB, user.id, { now: iso, isAdmin: adminEmails(c.env).has(user.email) });
      // Session first, then confirm the identity still exists: an unlink that slipped in after the lookup above has already deleted the
      // `oauth_<provider>` sessions that existed (VNX-2605c), so a session made now must not outlive it.
      const raw = await createSession(c.env.DB, user.id, now, method);
      if (!(await touchIdentityLogin(c.env.DB, { id: identity.id, userId: user.id, label: result.identity.label, now: iso }))) {
        await deleteSession(c.env.DB, raw);
        return await page(c, <OAuthNotLinkedPage locale={flow.locale} origin={new URL(c.req.url).origin} />);
      }
      // The audit row comes after the check (decision 10): a refused sign-in leaves no `auth.login`.
      await writeAudit(c.env.DB, { actorUserId: user.id, action: "auth.login", entity: "user", entityId: user.id, data: { method }, now: iso });
      writeSessionCookie(c, raw);
      return c.redirect(safeNext(flow.next) ?? localizedPath(flow.locale, "/"), 303);
    } catch {
      // No `err` is bound on purpose: nothing about it can reach a log (F5).
      return await failed(c, provider, "internal");
    }
  });
}
