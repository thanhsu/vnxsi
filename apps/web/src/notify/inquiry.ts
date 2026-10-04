import { writeAudit } from "../db/audit.ts";
import { findMessageContext, markMessageNotified, recordNotifyFailure, type MessageContext } from "../db/inquiries.ts";
import { builderFacingName, MAX_NOTIFY_ATTEMPTS } from "../domain/inquiry.ts";
import { getMailer } from "../email/index.ts";
import { inquiryDeclinedEmail, inquiryMessageEmail, inquiryMessageForBuilderEmail, newInquiryEmail } from "../email/templates/inquiry.ts";
import { requestSelectedEmail } from "../email/templates/request.ts";
import type { Bindings } from "../env.ts";
import { isLocale, localizedPath, type Locale } from "../i18n/locales.ts";

const asLocale = (value: string): Locale => (isLocale(value) ? value : "en");

/** Absolute link to the inquiry page on the recipient's side: the builder's Hub or the client's /me. */
export function inquiryUrl(env: Pick<Bindings, "APP_ORIGIN">, locale: Locale, inquiryId: string, side: "builder" | "client"): string {
  const path = side === "builder" ? `/hub/inquiries/${inquiryId}` : `/me/inquiries/${inquiryId}`;
  return new URL(localizedPath(locale, path), env.APP_ORIGIN).toString();
}

function compose(env: Bindings, ctx: MessageContext): { to: string; subject: string; text: string; html: string } {
  const { message, summary } = ctx;
  const inquiry = summary.inquiry;
  // What the inquiry is about: the product, or the request it came from (M6), or (null) the builder's services.
  const about = summary.productName ?? summary.requestTitle;
  const toBuilder = message.senderUserId === inquiry.clientUserId;
  if (toBuilder) {
    const locale = asLocale(ctx.builder.locale);
    const url = inquiryUrl(env, locale, inquiry.id, "builder");
    // The builder sees the client's typed name only, never the e-mail (spec §5.6).
    // Spec §5.7 step 4: the first message of a request inquiry is the "you were chosen" e-mail.
    const mail = !ctx.isFirst
      ? inquiryMessageForBuilderEmail(locale, { fromName: builderFacingName(inquiry.clientName), productName: about, body: message.body, url })
      : inquiry.type === "request"
        ? requestSelectedEmail(locale, { clientName: builderFacingName(inquiry.clientName), title: summary.requestTitle ?? "", body: message.body, url })
        : newInquiryEmail(locale, { clientName: builderFacingName(inquiry.clientName), type: inquiry.type, productName: about, budgetBand: inquiry.budgetBand, deadline: inquiry.deadline, message: message.body, url });
    return { to: ctx.builder.email, ...mail };
  }
  const locale = asLocale(ctx.client.locale);
  if (message.kind === "decline") {
    const url = new URL(localizedPath(locale, "/products"), env.APP_ORIGIN).toString();
    return { to: ctx.client.email, ...inquiryDeclinedEmail(locale, { builderName: summary.builderName, productName: about, reason: message.body, url }) };
  }
  const url = inquiryUrl(env, locale, inquiry.id, "client");
  return { to: ctx.client.email, ...inquiryMessageEmail(locale, { fromName: summary.builderName, productName: about, body: message.body, url }) };
}

// Never logs addresses: only the message id, the stage and the error text.
function logFailure(messageId: string, stage: "load" | "bookkeeping" | "mark_sent", err: unknown): void {
  console.error(JSON.stringify({ event: "inquiry.notify_failed", messageId, stage, error: String(err) }));
}

/**
 * Sends the e-mail for one inquiry message to the other party (spec §8.3). A failure is counted and left for the daily
 * job to retry; the third failure is written to audit_log. Never throws.
 */
export async function notifyInquiryMessage(env: Bindings, messageId: string, now: Date): Promise<"sent" | "failed" | "skipped"> {
  let ctx: MessageContext | null;
  try {
    ctx = await findMessageContext(env.DB, messageId);
  } catch (err) {
    logFailure(messageId, "load", err);
    return "skipped";
  }
  if (!ctx) return "skipped";
  const status = ctx.summary.inquiry.status;
  if (ctx.message.notifiedAt !== null || ctx.message.notifyAttempts >= MAX_NOTIFY_ATTEMPTS || status === "pending_verification" || status === "removed") return "skipped";
  try {
    await getMailer(env).send(compose(env, ctx));
  } catch (err) {
    try {
      const attempts = await recordNotifyFailure(env.DB, messageId);
      console.error(JSON.stringify({ event: "inquiry.notify_failed", messageId, attempts, error: String(err) }));
      if (attempts >= MAX_NOTIFY_ATTEMPTS) {
        await writeAudit(env.DB, { actorUserId: null, action: "inquiry.notify_failed", entity: "inquiry", entityId: ctx.summary.inquiry.id, data: { messageId }, now: now.toISOString() });
      }
    } catch (bookkeepingErr) {
      logFailure(messageId, "bookkeeping", bookkeepingErr);
    }
    return "failed";
  }
  try {
    await markMessageNotified(env.DB, messageId, now.toISOString());
  } catch (err) {
    // The mail went out; a later retry may send it twice, which we accept over reporting a failure.
    logFailure(messageId, "mark_sent", err);
  }
  return "sent";
}
