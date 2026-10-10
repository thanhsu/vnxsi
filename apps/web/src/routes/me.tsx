import type { Context, Hono } from "hono";
import { readSessionCookie } from "../auth/cookies.ts";
import { requireUser } from "../auth/middleware.ts";
import { linkSessionHash, writeOAuthCookie } from "../auth/oauth-cookie.ts";
import { listIdentitiesForUser, unlinkIdentity } from "../db/identities.ts";
import { listClientInquiries, listMessages } from "../db/inquiries.ts";
import { listClientRequests } from "../db/requests.ts";
import type { InquirySummary } from "../domain/inquiry.ts";
import { isOAuthProvider } from "../domain/identity.ts";
import { newLinkIntent } from "../domain/oauth.ts";
import type { AppEnv } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import { notifyIdentityChange } from "../notify/identity.ts";
import { errorResponse } from "../views/error-response.tsx";
import { InquiryList } from "../views/hub/InquiriesPage.tsx";
import { InquiryThread } from "../views/InquiryThread.tsx";
import { LINK_NOTICES, LinkedAccounts } from "../views/me/LinkedAccounts.tsx";
import { RequestList } from "../views/me/RequestList.tsx";
import { Layout } from "../views/Layout.tsx";
import { page } from "../views/render.ts";
import { loadForSide, postInquiryAction, type ThreadExtra } from "./hub-inquiries.tsx";
import { openPendingInquiry } from "./inquiry-confirm.ts";
import { availableProviders, enabledProvider } from "./oauth.tsx";

async function threadPage(c: Context<AppEnv>, summary: InquirySummary, extra: ThreadExtra = {}, status: 200 | 400 = 200) {
  const locale = c.get("locale");
  const tr = translator(locale);
  const messages = await listMessages(c.env.DB, summary.inquiry.id);
  const rest = `/me/inquiries/${summary.inquiry.id}`;
  const title = tr("inbox.to", { name: summary.builderName });
  return page(
    c,
    <Layout locale={locale} title={`${title} · VNX.SI`} origin={requestOrigin(c)} rest={rest} noindex signedIn>
      <p>
        <a href={localizedPath(locale, "/me")}>{tr("me.title")}</a>
      </p>
      <h1>{title}</h1>
      {summary.inquiry.status === "pending_verification" ? (
        <div class="notice">
          <p>{tr("me.pending")}</p>
          <form method="post" action={`${localizedPath(locale, rest)}/confirm`}>
            <button class="btn" type="submit">
              {tr("me.sendNow")}
            </button>
          </form>
        </div>
      ) : null}
      <InquiryThread locale={locale} summary={summary} messages={messages} viewer="client" base={localizedPath(locale, rest)} {...extra} />
    </Layout>,
    status,
  );
}

export function registerMeRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/me", requireUser, async (c) => {
    const locale = c.get("locale");
    const tr = translator(locale);
    const user = c.get("user")!;
    const notice = LINK_NOTICES.find((v) => v === c.req.query("link"));
    const [inquiries, requests, identities, linkable] = await Promise.all([listClientInquiries(c.env.DB, user.id), listClientRequests(c.env.DB, user.id), listIdentitiesForUser(c.env.DB, user.id), availableProviders(c)]);
    return page(
      c,
      <Layout locale={locale} title={`${tr("me.title")} · VNX.SI`} origin={requestOrigin(c)} rest="/me" noindex signedIn>
        <h1>{tr("me.title")}</h1>
        <section>
          <h2>{tr("me.requests.title")}</h2>
          <RequestList locale={locale} items={requests} />
          <p>
            <a href={localizedPath(locale, "/request")}>{tr("request.cta")}</a>
          </p>
        </section>
        <section>
          <h2>{tr("me.inquiries.title")}</h2>
          <InquiryList locale={locale} items={inquiries} viewer="client" base="/me/inquiries" />
        </section>
        <LinkedAccounts locale={locale} identities={identities} linkable={linkable} notice={notice} />
      </Layout>,
    );
  });

  // ADR-012 §4: "Link" is a POST (the Origin check is global). It writes one 120 s cookie for THIS session and sends the browser to the
  // same-site start. It never redirects off-site (`form-action 'self'`); start shows the page with the link to the provider.
  onLocalized(app, "post", "/me/identities/:provider/link", requireUser, async (c) => {
    const found = await enabledProvider(c);
    const raw = readSessionCookie(c);
    if (!found || !raw) return errorResponse(c, "notFound", 404);
    const now = Date.now();
    writeOAuthCookie(c, newLinkIntent({ provider: found.provider, sessionHash: await linkSessionHash(raw) }, now), now);
    return c.redirect(`/auth/oauth/${found.provider}/start?lang=${c.get("locale")}`, 303);
  });

  // ADR-012 §4: unlink is always allowed, flag on or off, configured or not (the e-mail link always remains). A POST that answers
  // 303 to the same site only. `unlinkIdentity` filters by this user, audits `{ provider }` in its batch, and returns null (no audit) when nothing was linked.
  onLocalized(app, "post", "/me/identities/:provider/unlink", requireUser, async (c) => {
    const provider = c.req.param("provider");
    if (!isOAuthProvider(provider)) return errorResponse(c, "notFound", 404);
    const user = c.get("user")!;
    const now = new Date().toISOString();
    const removed = await unlinkIdentity(c.env.DB, { userId: user.id, provider, now });
    if (removed) await notifyIdentityChange(c.env, { kind: "unlinked", to: user.email, locale: user.locale, provider, label: removed.label, at: now, requestId: c.get("requestId") });
    return c.redirect(`${localizedPath(c.get("locale"), "/me")}?link=${removed ? "unlinked" : "notLinked"}`, 303);
  });

  onLocalized(app, "get", "/me/inquiries/:id", requireUser, async (c) => {
    const summary = await loadForSide(c, "client", c.req.param("id") ?? "");
    return summary ? threadPage(c, summary) : errorResponse(c, "notFound", 404);
  });

  // "Send now": the signed-in session proves the owner's e-mail, so this is the state machine's "verify" transition done
  // on the owner's behalf, same rule as the e-mail link (the link lives 15 minutes, the pending inquiry 48 hours).
  onLocalized(app, "post", "/me/inquiries/:id/confirm", requireUser, async (c) => {
    const summary = await loadForSide(c, "client", c.req.param("id") ?? "");
    if (!summary) return errorResponse(c, "notFound", 404);
    if (summary.inquiry.status !== "pending_verification") return errorResponse(c, "conflict", 409);
    if (!(await openPendingInquiry(c, summary.inquiry, c.get("user")!, new Date(), "me"))) return errorResponse(c, "conflict", 409);
    return c.redirect(localizedPath(c.get("locale"), `/me/inquiries/${summary.inquiry.id}`), 303);
  });

  // Clients reply and close; declining is the builder's (spec §7.3), so /decline does not exist here (404).
  for (const action of ["reply", "close"] as const) {
    onLocalized(app, "post", `/me/inquiries/:id/${action}`, requireUser, (c) => postInquiryAction(c, "client", action, (cc, s, extra, status) => threadPage(cc, s, extra, status), "/me/inquiries"));
  }
}
