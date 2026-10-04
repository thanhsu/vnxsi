import type { Context, Hono } from "hono";
import { requireBuilder } from "../auth/middleware.ts";
import { auditStatement } from "../db/audit.ts";
import { addMessageStatement, findBuilderInquiry, findClientInquiry, listBuilderInquiries, listMessages, returnedInquiry, setInquiryStatusStatement } from "../db/inquiries.ts";
import { parseDeclineReason, parseMessageBody, transition, type InquiryAction, type InquirySummary } from "../domain/inquiry.ts";
import type { AppEnv } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import type { MessageKey } from "../i18n/messages/en.ts";
import { translator } from "../i18n/t.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import { notifyInquiryMessage } from "../notify/inquiry.ts";
import { errorResponse } from "../views/error-response.tsx";
import { HubLayout } from "../views/hub/HubLayout.tsx";
import { InquiryList } from "../views/hub/InquiriesPage.tsx";
import { InquiryThread } from "../views/InquiryThread.tsx";
import { page } from "../views/render.ts";

export type Side = "builder" | "client";

const BODY_ERROR_KEY: Record<"required" | "too_long", MessageKey> = {
  required: "thread.error.required",
  too_long: "thread.error.too_long",
};

/** Loads the inquiry for whoever is acting; anything they may not see reads as missing. */
export async function loadForSide(c: Context<AppEnv>, side: Side, id: string): Promise<InquirySummary | null> {
  const user = c.get("user")!;
  return side === "builder" ? findBuilderInquiry(c.env.DB, user.id, id) : findClientInquiry(c.env.DB, user.id, id);
}

export type ThreadExtra = { replyError?: string; reasonError?: string; values?: { body?: string; reason?: string } };
export type Rerender = (c: Context<AppEnv>, summary: InquirySummary, extra: ThreadExtra, status: 400) => Promise<Response>;

/**
 * One inquiry action (reply, decline, close) for the builder or the client: compare-and-set the status, add the
 * message (if any) and the audit row in one batch, then notify. Spec §7.3; a lost race or a wrong status is 409.
 */
export async function postInquiryAction(c: Context<AppEnv>, side: Side, action: Extract<InquiryAction, "reply" | "decline" | "close">, rerender: Rerender, threadPath: string) {
  const id = c.req.param("id") ?? "";
  const summary = await loadForSide(c, side, id);
  if (!summary) return errorResponse(c, "notFound", 404);
  // A suspended builder may not contact clients (plan M5).
  if (side === "builder" && c.get("builder")?.status === "suspended") return errorResponse(c, "conflict", 409);
  const inquiry = summary.inquiry;
  const next = transition(inquiry.status, action, side);
  if (!next.ok) return errorResponse(c, "conflict", 409);

  const tr = translator(c.get("locale"));
  const form = await c.req.parseBody();
  let message: { kind: "message" | "decline"; body: string } | null = null;
  if (action === "reply") {
    const body = parseMessageBody(form.body);
    if (!body.ok) return rerender(c, summary, { replyError: tr(BODY_ERROR_KEY[body.error]), values: { body: typeof form.body === "string" ? form.body : "" } }, 400);
    message = { kind: "message", body: body.body };
  } else if (action === "decline") {
    const reason = parseDeclineReason(form.reason);
    if (!reason.ok) return rerender(c, summary, { reasonError: tr("thread.error.too_long"), values: { reason: typeof form.reason === "string" ? form.reason : "" } }, 400);
    message = { kind: "decline", body: reason.reason };
  }

  const user = c.get("user")!;
  const now = new Date();
  const iso = now.toISOString();
  const guard = { inquiryId: inquiry.id, status: next.status, updatedAt: iso };
  const statements = [setInquiryStatusStatement(c.env.DB, { id: inquiry.id, from: inquiry.status, to: next.status, now: iso })];
  if (message) statements.push(addMessageStatement(c.env.DB, { inquiryId: inquiry.id, senderUserId: user.id, kind: message.kind, body: message.body, now: iso }, guard));
  statements.push(auditStatement(c.env.DB, { actorUserId: user.id, action: `inquiry.${action}`, entity: "inquiry", entityId: inquiry.id, data: { by: side, from: inquiry.status, to: next.status }, now: iso }, guard));
  const results = await c.env.DB.batch(statements);
  if (!returnedInquiry(results[0])) return errorResponse(c, "conflict", 409);
  const messageId = message ? (results[1]?.results[0] as { id: string } | undefined)?.id : undefined;
  if (messageId) await notifyInquiryMessage(c.env, messageId, now);
  return c.redirect(localizedPath(c.get("locale"), `${threadPath}/${inquiry.id}`), 303);
}

async function threadPage(c: Context<AppEnv>, summary: InquirySummary, extra: ThreadExtra = {}, status: 200 | 400 = 200) {
  const locale = c.get("locale");
  const tr = translator(locale);
  const messages = await listMessages(c.env.DB, summary.inquiry.id);
  const rest = `/hub/inquiries/${summary.inquiry.id}`;
  return page(
    c,
    <HubLayout locale={locale} origin={requestOrigin(c)} title={tr("inbox.from", { name: summary.inquiry.clientName })} rest={rest} active="inquiries">
      <h1>{tr("inbox.from", { name: summary.inquiry.clientName })}</h1>
      <InquiryThread locale={locale} summary={summary} messages={messages} viewer="builder" base={localizedPath(locale, rest)} {...extra} />
    </HubLayout>,
    status,
  );
}

export function registerHubInquiryRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/hub/inquiries", requireBuilder, async (c) => {
    const locale = c.get("locale");
    const tr = translator(locale);
    const items = await listBuilderInquiries(c.env.DB, c.get("builder").userId);
    return page(
      c,
      <HubLayout locale={locale} origin={requestOrigin(c)} title={tr("inbox.title")} rest="/hub/inquiries" active="inquiries">
        <h1>{tr("inbox.title")}</h1>
        <InquiryList locale={locale} items={items} viewer="builder" base="/hub/inquiries" />
      </HubLayout>,
    );
  });

  onLocalized(app, "get", "/hub/inquiries/:id", requireBuilder, async (c) => {
    const summary = await loadForSide(c, "builder", c.req.param("id") ?? "");
    return summary ? threadPage(c, summary) : errorResponse(c, "notFound", 404);
  });

  for (const action of ["reply", "decline", "close"] as const) {
    onLocalized(app, "post", `/hub/inquiries/:id/${action}`, requireBuilder, (c) => postInquiryAction(c, "builder", action, (cc, s, extra, status) => threadPage(cc, s, extra, status), "/hub/inquiries"));
  }
}
