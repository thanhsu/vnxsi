import type { Context, Hono } from "hono";
import { requireUser } from "../auth/middleware.ts";
import { listClientInquiries, listMessages } from "../db/inquiries.ts";
import { listClientRequests } from "../db/requests.ts";
import type { InquirySummary } from "../domain/inquiry.ts";
import type { AppEnv } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import { errorResponse } from "../views/error-response.tsx";
import { InquiryList } from "../views/hub/InquiriesPage.tsx";
import { InquiryThread } from "../views/InquiryThread.tsx";
import { RequestList } from "../views/me/RequestList.tsx";
import { Layout } from "../views/Layout.tsx";
import { page } from "../views/render.ts";
import { loadForSide, postInquiryAction, type ThreadExtra } from "./hub-inquiries.tsx";
import { openPendingInquiry } from "./inquiry-confirm.ts";

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
    const [inquiries, requests] = await Promise.all([listClientInquiries(c.env.DB, user.id), listClientRequests(c.env.DB, user.id)]);
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
      </Layout>,
    );

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
