import { writeAudit } from "../db/audit.ts";
import { findMessageContext, markMessageNotified, recordNotifyFailure, type MessageContext } from "../db/inquiries.ts";
import { MAX_NOTIFY_ATTEMPTS } from "../domain/inquiry.ts";
import { getMailer } from "../email/index.ts";
import { inquiryDeclinedEmail, inquiryMessageEmail, newInquiryEmail } from "../email/templates/inquiry.ts";
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
  const toBuilder = message.senderUserId === inquiry.clientUserId;
  if (toBuilder) {
    const locale = asLocale(ctx.builder.locale);
    const url = inquiryUrl(env, locale, inquiry.id, "builder");
    // The builder sees the client's typed name only, never the e-mail (spec §5.6).
    const mail = ctx.isFirst
      ? newInquiryEmail(locale, { clientName: inquiry.clientName, type: inquiry.type, productName: summary.productName, budgetBand: inquiry.budgetBand, deadline: inquiry.deadline, message: message.body, url })
      : inquiryMessageEmail(locale, { fromName: inquiry.clientName, productName: summary.productName, body: message.body, url });
    return { to: ctx.builder.email, ...mail };
  }
  const locale = asLocale(ctx.client.locale);
  if (message.kind === "decline") {
    const url = new URL(localizedPath(locale, "/products"), env.APP_ORIGIN).toString();
    return { to: ctx.client.email, ...inquiryDeclinedEmail(locale, { builderName: summary.builderName, productName: summary.productName, reason: message.body, url }) };
  }
  const url = inquiryUrl(env, locale, inquiry.id, "client");
  return { to: ctx.client.email, ...inquiryMessageEmail(locale, { fromName: summary.builderName, productName: summary.productName, body: message.body, url }) };
}

/**
 * Sends the e-mail for one inquiry message to the other party (spec §8.3). A failure is counted and left for the daily
 * job to retry; the third failure is written to audit_log. Never throws.
 */
export async function notifyInquiryMessage(env: Bindings, messageId: string, now: Date): Promise<"sent" | "failed" | "skipped"> {
  const ctx = await findMessageContext(env.DB, messageId);
  if (!ctx) return "skipped";
  const status = ctx.summary.inquiry.status;
  if (ctx.message.notifiedAt !== null || ctx.message.notifyAttempts >= MAX_NOTIFY_ATTEMPTS || status === "pending_verification" || status === "removed") return "skipped";
  try {
    await getMailer(env).send(compose(env, ctx));
  } catch (err) {
    const attempts = await recordNotifyFailure(env.DB, messageId);
    console.error(JSON.stringify({ event: "inquiry.notify_failed", messageId, attempts, error: String(err) }));
    if (attempts >= MAX_NOTIFY_ATTEMPTS) {
      await writeAudit(env.DB, { actorUserId: null, action: "inquiry.notify_failed", entity: "inquiry", entityId: ctx.summary.inquiry.id, data: { messageId }, now: now.toISOString() });
    }
    return "failed";
  }
  await markMessageNotified(env.DB, messageId, now.toISOString());
  return "sent";
}
