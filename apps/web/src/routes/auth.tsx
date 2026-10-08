import type { Context, Hono } from "hono";
import { z } from "zod";
import { adminEmails } from "../auth/admin.ts";
import { clearSessionCookie, readSessionCookie, writeSessionCookie } from "../auth/cookies.ts";
import { sha256Hex } from "../auth/crypto.ts";
import { readInviteCookie, writeInviteCookie } from "../auth/invite-cookie.ts";
import { isProviderConfigured } from "../auth/oauth/index.ts";
import { createSession, deleteSession } from "../auth/sessions.ts";
import { type ConsumedToken, consumeLoginToken, createLoginToken, describeToken, peekLoginToken, type TokenPurpose } from "../auth/tokens.ts";
import { writeAudit } from "../db/audit.ts";
import { isFlagEnabled } from "../db/flags.ts";
import { findInquiryById } from "../db/inquiries.ts";
import { findRequestById } from "../db/requests.ts";
import { createUser, findUserByEmail, markLogin, type UserRow } from "../db/users.ts";
import { getMailer } from "../email/index.ts";
import { loginEmail } from "../email/templates/login.ts";
import { OAUTH_PROVIDERS, type OAuthProvider, PROVIDER_FLAG } from "../domain/identity.ts";
import type { AppEnv } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import { onLocalized } from "../http/localized.ts";
import { safeNext } from "../http/next.ts";
import { hitRateLimit } from "../http/rate-limit.ts";
import { ConfirmLinkPage, InvalidLinkPage, LoginPage, LoginSentPage } from "../views/auth.tsx";
import { errorResponse } from "../views/error-response.tsx";
import { page } from "../views/render.ts";
import { openPendingInquiry } from "./inquiry-confirm.ts";
import { openPendingRequest } from "./request-confirm.ts";

const LoginForm = z.object({ email: z.string().trim().toLowerCase().pipe(z.email().max(254)) });

const HOUR = 3600;

function origin(c: Context<AppEnv>) {
  return new URL(c.req.url).origin;
}

/** The providers whose button `/login` shows: flag on AND configured, the rule `routes/oauth.tsx` applies to start and callback (decision 6). */
async function loginProviders(c: Context<AppEnv>): Promise<OAuthProvider[]> {
  const shown: OAuthProvider[] = [];
  for (const provider of OAUTH_PROVIDERS) {
    if ((await isFlagEnabled(c.env.DB, PROVIDER_FLAG[provider])) && isProviderConfigured(c.env, provider)) shown.push(provider);
  }
  return shown;
}

/** Purposes the confirmation link accepts. */
export const VERIFY_PURPOSES: TokenPurpose[] = ["login", "inquiry_verify", "request_verify"];

/** Signs the token's e-mail in (creating the account the first time) and sets the session cookie. Null when suspended. */
async function completeLogin(c: Context<AppEnv>, token: ConsumedToken, now: Date): Promise<UserRow | null> {
  const iso = now.toISOString();
  const user = (await findUserByEmail(c.env.DB, token.email)) ?? (await createUser(c.env.DB, { email: token.email, locale: token.locale, now: iso }));
  if (user.status !== "active") return null;
  await markLogin(c.env.DB, user.id, { now: iso, isAdmin: adminEmails(c.env).has(token.email) });
  await writeAudit(c.env.DB, { actorUserId: user.id, action: "auth.login", entity: "user", entityId: user.id, data: { purpose: token.purpose }, now: iso });
  writeSessionCookie(c, await createSession(c.env.DB, user.id, now));
  // The link may be opened on another device: restore the invite there (spec §5.3).
  if (token.inviteCodeHash) writeInviteCookie(c, token.inviteCodeHash);
  return user;
}

/**
 * Spec §5.6 step 3: confirming the e-mail opens the pending inquiry, names the account the first time and tells the
 * builder. Returns where to go: the inquiry, or /me when it is no longer pending (already opened, removed or expired).
 * The compare-and-set pending_verification -> open below is the state machine's "verify" rule (domain/inquiry.ts).
 */
async function confirmInquiry(c: Context<AppEnv>, token: ConsumedToken, user: UserRow, now: Date): Promise<string> {
  const inquiry = token.inquiryId ? await findInquiryById(c.env.DB, token.inquiryId) : null;
  if (!inquiry || inquiry.clientUserId !== user.id || inquiry.status !== "pending_verification") return localizedPath(token.locale, "/me");
  if (!(await openPendingInquiry(c, inquiry, user, now, "link"))) return localizedPath(token.locale, "/me");
  return localizedPath(token.locale, `/me/inquiries/${inquiry.id}`);
}

/**
 * Spec §5.7 step 1: confirming the e-mail submits the pending request, names the account the first time and tells the
 * admins. Returns where to go: the request, or /me when it is not this account's pending request any more.
 */
async function confirmRequest(c: Context<AppEnv>, token: ConsumedToken, user: UserRow, now: Date): Promise<string> {
  const request = token.requestId ? await findRequestById(c.env.DB, token.requestId) : null;
  if (!request || request.clientUserId !== user.id || request.status !== "pending_verification") return localizedPath(token.locale, "/me");
  if (!(await openPendingRequest(c, request, user, now, "link"))) return localizedPath(token.locale, "/me");
  return localizedPath(token.locale, `/me/requests/${request.id}`);
}

/** The dead-link page in the language the link was requested in (English when the token is unknown). */
async function invalidLink(c: Context<AppEnv>, raw: string) {
  const known = await describeToken(c.env.DB, raw);
  return page(c, <InvalidLinkPage locale={known?.locale ?? "en"} origin={origin(c)} hint={known?.purpose === "inquiry_verify" ? "inquiry" : known?.purpose === "request_verify" ? "request" : undefined} />, 400);
}

export function registerAuthRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/login", async (c) =>
    page(c, <LoginPage locale={c.get("locale")} origin={origin(c)} next={safeNext(c.req.query("next"))} providers={await loginProviders(c)} />),
  );

  onLocalized(app, "post", "/login", async (c) => {
    const locale = c.get("locale");
    const tr = translator(locale);
    const form = await c.req.parseBody();
    const next = safeNext(form.next);
    const retry = async (status: 400 | 429 | 502, email: string, error: string) =>
      page(c, <LoginPage locale={locale} origin={origin(c)} email={email} next={next} error={error} providers={await loginProviders(c)} />, status);
    const parsed = LoginForm.safeParse({ email: form.email });
    if (!parsed.success) {
      const typed = typeof form.email === "string" ? form.email : "";
      return retry(400, typed, tr("login.error.email"));
    }
    const email = parsed.data.email;
    const now = new Date();
    const ip = c.req.header("cf-connecting-ip") ?? "unknown";
    const byEmail = await hitRateLimit(c.env.DB, `login:email:${await sha256Hex(email)}`, 5, HOUR, now.getTime());
    const byIp = await hitRateLimit(c.env.DB, `login:ip:${ip}`, 20, HOUR, now.getTime());
    if (!byEmail.allowed || !byIp.allowed) {
      return retry(429, email, tr("login.error.rateLimited"));
    }

    const token = await createLoginToken(c.env.DB, { email, purpose: "login", locale, inviteCodeHash: readInviteCookie(c) }, now);
    const link = new URL("/auth/verify", c.env.APP_ORIGIN);
    link.searchParams.set("t", token);
    if (next) link.searchParams.set("next", next);
    try {
      await getMailer(c.env).send({ to: email, ...loginEmail(locale, link.toString()) });
    } catch (err) {
      console.error(JSON.stringify({ requestId: c.get("requestId"), event: "login.mail_failed", error: String(err) }));
      return retry(502, email, tr("login.error.sendFailed"));
    }
    return page(c, <LoginSentPage locale={locale} origin={origin(c)} email={email} />);
  });

  // VNX-0506: link scanners in corporate mail open links with GET; only the button (POST) spends the token.
  app.get("/auth/verify", async (c) => {
    c.header("Cache-Control", "no-store");
    // The token is in the URL (GET) and in the form (POST): never leak the page's address cross-site (VNX-0803 F2).
    // Not "no-referrer": that makes the browser send "Origin: null" on the form POST and originCheck refuses it (review F1).
    c.header("Referrer-Policy", "same-origin");
    const raw = c.req.query("t") ?? "";
    const peek = await peekLoginToken(c.env.DB, raw, new Date(), VERIFY_PURPOSES);
    if (!peek.ok) return invalidLink(c, raw);
    const purpose = peek.purpose === "login" ? "login" : peek.purpose === "inquiry_verify" ? "inquiry" : "request";
    return page(c, <ConfirmLinkPage locale={peek.locale} origin={origin(c)} token={raw} next={safeNext(c.req.query("next"))} purpose={purpose} />);
  });

  app.post("/auth/verify", async (c) => {
    c.header("Cache-Control", "no-store");
    // The token is in the URL (GET) and in the form (POST): never leak the page's address cross-site (VNX-0803 F2).
    // Not "no-referrer": that makes the browser send "Origin: null" on the form POST and originCheck refuses it (review F1).
    c.header("Referrer-Policy", "same-origin");
    const form = await c.req.parseBody();
    const now = new Date();
    const result = await consumeLoginToken(c.env.DB, typeof form.t === "string" ? form.t : "", now, VERIFY_PURPOSES);
    if (!result.ok) return invalidLink(c, typeof form.t === "string" ? form.t : "");
    const user = await completeLogin(c, result.token, now);
    if (!user) return errorResponse(c, "forbidden", 403);
    if (result.token.purpose === "inquiry_verify") return c.redirect(await confirmInquiry(c, result.token, user, now), 303);
    if (result.token.purpose === "request_verify") return c.redirect(await confirmRequest(c, result.token, user, now), 303);
    return c.redirect(safeNext(form.next) ?? "/", 303);
  });

  app.post("/logout", async (c) => {
    const raw = readSessionCookie(c);
    if (raw) await deleteSession(c.env.DB, raw);
    clearSessionCookie(c);
    return c.redirect("/", 303);
  });
}
