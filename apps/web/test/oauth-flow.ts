import { createApp } from "../src/app.ts";
import { OAUTH_COOKIE } from "../src/auth/oauth-cookie.ts";
import { issueFakeCode } from "../src/auth/oauth/fake.ts";
import { setFlag } from "../src/db/flags.ts";
import { linkIdentity } from "../src/db/identities.ts";
import { PROVIDER_FLAG, type OAuthProvider } from "../src/domain/identity.ts";
import { type FlowCookie, oauthRedirectUri, parseOAuthCookie } from "../src/domain/oauth.ts";
import type { Bindings } from "../src/env.ts";
import { ensureUser } from "./fixtures.ts";
import { formPost, getReq, setCookieValue, testEnv } from "./helpers.ts";

export async function enableProvider(provider: OAuthProvider) {
  const admin = await ensureUser("oauth-flags@example.com");
  await setFlag(testEnv.DB, { key: PROVIDER_FLAG[provider], enabled: true, actorUserId: admin.id, now: new Date().toISOString() });
}

export async function linkedUser(email: string, provider: OAuthProvider, identity: { subject: string; label: string }) {
  const user = await ensureUser(email);
  const linked = await linkIdentity(testEnv.DB, { userId: user.id, provider, subject: identity.subject, label: identity.label, now: new Date().toISOString() });
  if (!linked.ok) throw new Error(`link failed: ${linked.reason}`);
  return { user, identity: linked.identity };
}

export interface StartedFlow {
  res: Response;
  /** `Cookie` header value carrying the flow cookie, as the browser sends it back to the callback. */
  cookie: string;
  flow: FlowCookie;
  authorize: URL;
}

/** Calls `/start` the way a browser does and reads back the flow cookie it set. Throws unless start answered 302 with a flow cookie. */
export async function startOAuth(provider: OAuthProvider, query = "", cookie?: string): Promise<StartedFlow> {
  const res = await createApp().request(getReq(`/auth/oauth/${provider}/start${query}`, cookie), undefined, testEnv);
  const raw = setCookieValue(res, OAUTH_COOKIE) ?? "";
  const flow = parseOAuthCookie(raw, { provider, now: Date.now() });
  if (res.status !== 302 || !flow || flow.phase !== "flow") throw new Error(`start answered ${res.status}`);
  return { res, cookie: `${OAUTH_COOKIE}=${raw}`, flow, authorize: new URL(res.headers.get("location") ?? "") };
}

/** F3: the fake provider needs verifier, nonce AND redirect URI. The redirect URI comes from APP_ORIGIN, never from a request. */
export function issueCodeFor(provider: OAuthProvider, started: StartedFlow, identity: { subject: string; label: string }, override: Partial<{ verifier: string; nonce: string; redirectUri: string }> = {}): string {
  return issueFakeCode(provider, identity, { verifier: started.flow.verifier, nonce: started.flow.nonce, redirectUri: oauthRedirectUri(testEnv.APP_ORIGIN, provider), ...override });
}

// D1 is shared across tests, and the callback is rate limited per IP: each request gets its own address unless the caller sets one.
let nextIp = 0;
const freshIp = () => `198.51.${(++nextIp >> 8) & 255}.${nextIp & 255}`;

export function callbackReq(provider: string, params: Record<string, string>, cookie?: string, headers: Record<string, string> = {}, env: Bindings = testEnv) {
  const url = new URL(`https://vnx.si/auth/oauth/${provider}/callback`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return createApp().request(new Request(url, { headers: { "cf-connecting-ip": freshIp(), ...(cookie ? { cookie } : {}), ...headers } }), undefined, env);
}

/** The Set-Cookie line that deletes the OAuth cookie, or null. */
export function clearedOAuthCookie(res: Response): string | null {
  return res.headers.getSetCookie().find((line) => line.startsWith(`${OAUTH_COOKIE}=`) && /Max-Age=0/i.test(line)) ?? null;
}

export interface LinkedStart {
  /** The `POST /me/identities/:provider/link` response. */
  post: Response;
  /** The `GET /auth/oauth/:provider/start` the browser makes after the 303, carrying the session and the intent cookie. */
  start: Response;
  html: string;
  /** `Cookie` header value for the flow cookie `start` wrote, or "" when it wrote none. */
  flowCookie: string;
  flow: FlowCookie | null;
}

/** Off-site `<a href>` of a page, entities decoded as a browser does. */
export function externalLinks(html: string): URL[] {
  return [...html.matchAll(/<a\b[^>]*\bhref="(https?:\/\/[^"]+)"/g)].map((m) => new URL((m[1] ?? "").replaceAll("&amp;", "&")));
}

/** The whole link start the way a browser does it: press "Link" (POST), follow the 303 to the same-site start. */
/** `postPrefix` picks the locale the way a browser does: the form posts to `/vi/me/…`. Never append a second `lang` to the start URL: Hono reads the FIRST value. */
export async function linkViaStart(provider: OAuthProvider, session: string, opts: { postPrefix?: string; extraQuery?: string } = {}): Promise<LinkedStart> {
  const post = await createApp().request(formPost(`${opts.postPrefix ?? ""}/me/identities/${provider}/link`, {}, { cookie: session }), undefined, testEnv);
  const intent = setCookieValue(post, OAUTH_COOKIE) ?? "";
  const target = new URL(post.headers.get("location") ?? "/", "https://vnx.si");
  const start = await createApp().request(getReq(`${target.pathname}${target.search}${opts.extraQuery ?? ""}`, `${session}; ${OAUTH_COOKIE}=${intent}`), undefined, testEnv);
  const raw = setCookieValue(start, OAUTH_COOKIE) ?? "";
  const flow = parseOAuthCookie(raw, { provider, now: Date.now() });
  return { post, start, html: await start.clone().text(), flowCookie: raw ? `${OAUTH_COOKIE}=${raw}` : "", flow: flow && flow.phase === "flow" ? flow : null };
}
