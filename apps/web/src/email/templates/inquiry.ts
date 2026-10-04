import type { BudgetBand, InquiryType } from "../../domain/inquiry.ts";
import type { Locale } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator } from "../../i18n/t.ts";
import { escapeHtml } from "../escape.ts";

type Email = { subject: string; text: string; html: string };

// Same keys as views/labels.ts (email/ may only import i18n; see ARCHITECTURE §2).
const TYPE_KEY: Record<InquiryType, MessageKey> = {
  buy: "inquiry.type.buy",
  customize: "inquiry.type.customize",
  hire: "inquiry.type.hire",
  build_similar: "inquiry.type.build_similar",
  request: "inquiry.type.request",
};
const BUDGET_KEY: Record<BudgetBand, MessageKey> = {
  "<500": "inquiry.budget.lt500",
  "500-2k": "inquiry.budget.500-2k",
  "2k-10k": "inquiry.budget.2k-10k",
  ">10k": "inquiry.budget.gt10k",
  unsure: "inquiry.budget.unsure",
};

const p = (text: string) => `<p>${escapeHtml(text)}</p>`;
const link = (href: string) => `<p><a href="${escapeHtml(href)}">${escapeHtml(href)}</a></p>`;
const quote = (text: string) => `<blockquote style="white-space:pre-line;border-left:3px solid #DCE0E6;margin:0;padding-left:12px">${escapeHtml(text)}</blockquote>`;
const wrap = (locale: string, parts: string[]) =>
  `<!doctype html><html lang="${locale}"><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0D1526">${parts.join("")}</body></html>`;

function target(locale: Locale, productName: string | null): string {
  return productName ?? translator(locale)("inquiry.profileTarget");
}

export function inquiryConfirmEmail(locale: Locale, input: { builderName: string; productName: string | null; link: string }): Email {
  const tr = translator(locale);
  const body = tr("email.inquiryConfirm.body", { builder: input.builderName, product: target(locale, input.productName) });
  const ignore = tr("email.inquiryConfirm.ignore");
  return { subject: tr("email.inquiryConfirm.subject"), text: `${body}\n\n${input.link}\n\n${ignore}`, html: wrap(locale, [p(body), link(input.link), p(ignore)]) };
}

export function newInquiryEmail(
  locale: Locale,
  input: { clientName: string; type: InquiryType; productName: string | null; budgetBand: BudgetBand; deadline: string | null; message: string; url: string },
): Email {
  const tr = translator(locale);
  const type = tr(TYPE_KEY[input.type]);
  const intro = tr("email.newInquiry.intro", { client: input.clientName, type, product: target(locale, input.productName) });
  const facts = [tr("email.newInquiry.budget", { budget: tr(BUDGET_KEY[input.budgetBand]) }), ...(input.deadline ? [tr("email.newInquiry.deadline", { deadline: input.deadline })] : [])];
  const cta = tr("email.newInquiry.cta");
  return {
    subject: tr("email.newInquiry.subject", { type, client: input.clientName }),
    text: `${intro}\n${facts.join("\n")}\n\n${input.message}\n\n${cta}\n${input.url}`,
    html: wrap(locale, [p(intro), ...facts.map(p), quote(input.message), p(cta), link(input.url)]),
  };
}

export function inquiryMessageEmail(locale: Locale, input: { fromName: string; productName: string | null; body: string; url: string }): Email {
  const tr = translator(locale);
  const intro = tr("email.inquiryMessage.intro", { from: input.fromName, product: target(locale, input.productName) });
  const cta = tr("email.inquiryMessage.cta");
  return {
    subject: tr("email.inquiryMessage.subject", { from: input.fromName }),
    text: `${intro}\n\n${input.body}\n\n${cta}\n${input.url}`,
    html: wrap(locale, [p(intro), quote(input.body), p(cta), link(input.url)]),
  };
}

export function inquiryDeclinedEmail(locale: Locale, input: { builderName: string; productName: string | null; reason: string; url: string }): Email {
  const tr = translator(locale);
  const intro = tr("email.inquiryDeclined.intro", { builder: input.builderName, product: target(locale, input.productName) });
  const cta = tr("email.inquiryDeclined.cta");
  const reasonText = input.reason ? `\n\n${tr("email.inquiryDeclined.reason")}\n${input.reason}` : "";
  const reasonHtml = input.reason ? [p(tr("email.inquiryDeclined.reason")), quote(input.reason)] : [];
  return {
    subject: tr("email.inquiryDeclined.subject", { builder: input.builderName }),
    text: `${intro}${reasonText}\n\n${cta}\n${input.url}`,
    html: wrap(locale, [p(intro), ...reasonHtml, p(cta), link(input.url)]),
  };
}

export function inquiryReminderEmail(locale: Locale, input: { clientName: string; productName: string | null; url: string }): Email {
  const tr = translator(locale);
  const body = tr("email.inquiryReminder.body", { client: input.clientName, product: target(locale, input.productName) });
  const cta = tr("email.inquiryReminder.cta");
  return { subject: tr("email.inquiryReminder.subject", { client: input.clientName }), text: `${body}\n\n${cta}\n${input.url}`, html: wrap(locale, [p(body), p(cta), link(input.url)]) };
}

/** Internal digest for ADMIN_EMAILS (plan M5: English only). */
export function inquiryAdminAlertEmail(items: { id: string; builderHandle: string; productName: string | null; openedAt: string }[], url: string): Email {
  const lines = items.map((i) => `${i.id} · @${i.builderHandle} · ${i.productName ?? "(builder profile)"} · opened ${i.openedAt.slice(0, 10)}`);
  const intro = `These inquiries have had no reply for 7 days:`;
  return {
    subject: `${items.length} ${items.length === 1 ? "inquiry" : "inquiries"} unanswered for 7 days`,
    text: `${intro}\n\n${lines.join("\n")}\n\n${url}`,
    html: wrap("en", [p(intro), `<ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`, link(url)]),
  };
}
