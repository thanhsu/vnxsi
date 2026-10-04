import type { Context, Hono } from "hono";
import { requireUser } from "../auth/middleware.ts";
import { listClientInquiries, listMessages } from "../db/inquiries.ts";
import type { InquirySummary } from "../domain/inquiry.ts";
import type { AppEnv } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import { errorResponse } from "../views/error-response.tsx";
import { InquiryList } from "../views/hub/InquiriesPage.tsx";
import { InquiryThread } from "../views/InquiryThread.tsx";
import { Layout } from "../views/Layout.tsx";
import { page } from "../views/render.ts";
import { loadForSide, postInquiryAction, type ThreadExtra } from "./hub-inquiries.tsx";

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
      {summary.inquiry.status === "pending_verification" ? <p class="notice">{tr("me.pending")}</p> : null}
      <InquiryThread locale={locale} summary={summary} messages={messages} viewer="client" base={localizedPath(locale, rest)} {...extra} />
    </Layout>,
    status,
  );
}

export function registerMeRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/me", requireUser, async (c) => {
    const locale = c.get("locale");
    const tr = translator(locale);
    const items = await listClientInquiries(c.env.DB, c.get("user")!.id);
    return page(
      c,
      <Layout locale={locale} title={`${tr("me.title")} · VNX.SI`} origin={requestOrigin(c)} rest="/me" noindex signedIn>
        <h1>{tr("me.title")}</h1>
        <InquiryList locale={locale} items={items} viewer="client" base="/me/inquiries" />
      </Layout>,
    );
  });

  onLocalized(app, "get", "/me/inquiries/:id", requireUser, async (c) => {
    const summary = await loadForSide(c, "client", c.req.param("id") ?? "");
    return summary ? threadPage(c, summary) : errorResponse(c, "notFound", 404);
  });

  // Clients reply and close; declining is the builder's (spec §7.3), so /decline does not exist here (404).
  for (const action of ["reply", "close"] as const) {
    onLocalized(app, "post", `/me/inquiries/:id/${action}`, requireUser, (c) => postInquiryAction(c, "client", action, (cc, s, extra, status) => threadPage(cc, s, extra, status), "/me/inquiries"));
  }
}
