import type { BudgetBand, BuilderFacingName } from "../../domain/inquiry.ts";
import type { Category } from "../../domain/product.ts";
import type { Locale } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator } from "../../i18n/t.ts";
import { link, p, quote, wrap } from "../parts.ts";
import { BUDGET_KEY } from "./inquiry.ts";

type Email = { subject: string; text: string; html: string };

// Same keys as views/labels.ts (email/ may only import i18n; see ARCHITECTURE §2); a test keeps them equal.
export const CATEGORY_KEY: Record<Category, MessageKey> = {
  booking: "product.category.booking",
  crm: "product.category.crm",
  ecommerce: "product.category.ecommerce",
  finance: "product.category.finance",
  hr: "product.category.hr",
  education: "product.category.education",
  internal_tools: "product.category.internal_tools",
  ai_agents: "product.category.ai_agents",
  other: "product.category.other",
};

/** Whole US dollars with the locale's digit grouping. */
const usd = (locale: Locale, cents: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(cents / 100);

/** The e-mail that asks the client to confirm (sent by the route, which shows an error on the form when it fails). */
export function requestConfirmEmail(locale: Locale, input: { title: string; link: string }): Email {
  const tr = translator(locale);
  const body = tr("email.requestConfirm.body", { title: input.title });
  const ignore = tr("email.requestConfirm.ignore");
  return { subject: tr("email.requestConfirm.subject"), text: `${body}\n\n${input.link}\n\n${ignore}`, html: wrap(locale, [p(body), link(input.link), p(ignore)]) };
}

/** To the invited builder: the client's typed name only, never the e-mail (spec §5.7 step 3). */
export function requestInviteEmail(
  locale: Locale,
  input: { clientName: BuilderFacingName; title: string; category: Category; budgetBand: BudgetBand; deadline: string | null; days: number; url: string },
): Email {
  const tr = translator(locale);
  const intro = tr("email.requestInvite.intro", { client: input.clientName, title: input.title });
  const facts = [
    tr("email.requestInvite.category", { category: tr(CATEGORY_KEY[input.category]) }),
    tr("email.newInquiry.budget", { budget: tr(BUDGET_KEY[input.budgetBand]) }),
    ...(input.deadline ? [tr("email.newInquiry.deadline", { deadline: input.deadline })] : []),
  ];
  const cta = tr("email.requestInvite.cta", { days: input.days });
  return {
    subject: tr("email.requestInvite.subject", { title: input.title }),
    text: `${intro}\n${facts.join("\n")}\n\n${cta}\n${input.url}`,
    html: wrap(locale, [p(intro), ...facts.map(p), p(cta), link(input.url)]),
  };
}

export function requestReminderEmail(locale: Locale, input: { clientName: BuilderFacingName; title: string; days: number; url: string }): Email {
  const tr = translator(locale);
  const body = tr("email.requestReminder.body", { client: input.clientName, title: input.title, days: input.days });
  const cta = tr("email.requestReminder.cta");
  return { subject: tr("email.requestReminder.subject", { title: input.title }), text: `${body}\n\n${cta}\n${input.url}`, html: wrap(locale, [p(body), p(cta), link(input.url)]) };
}

export function requestInviteExpiredEmail(locale: Locale, input: { title: string; url: string }): Email {
  const tr = translator(locale);
  const body = tr("email.requestInviteExpired.body", { title: input.title });
  const cta = tr("email.requestInviteExpired.cta");
  return { subject: tr("email.requestInviteExpired.subject", { title: input.title }), text: `${body}\n\n${cta}\n${input.url}`, html: wrap(locale, [p(body), p(cta), link(input.url)]) };
}

/** To the client: who, the price and the time. The approach stays on /me. */
export function requestProposalEmail(
  locale: Locale,
  input: { builderName: string; title: string; priceCents: number | null; priceMaxCents: number | null; timelineDays: number; url: string },
): Email {
  const tr = translator(locale);
  const intro = tr("email.requestProposal.intro", { builder: input.builderName, title: input.title });
  const price =
    input.priceCents === null
      ? tr("email.requestProposal.priceDiscuss")
      : input.priceMaxCents === null
        ? tr("email.requestProposal.priceFixed", { price: usd(locale, input.priceCents) })
        : tr("email.requestProposal.priceRange", { from: usd(locale, input.priceCents), to: usd(locale, input.priceMaxCents) });
  const facts = [price, tr("email.requestProposal.timeline", { days: input.timelineDays })];
  const cta = tr("email.requestProposal.cta");
  return {
    subject: tr("email.requestProposal.subject", { builder: input.builderName }),
    text: `${intro}\n${facts.join("\n")}\n\n${cta}\n${input.url}`,
    html: wrap(locale, [p(intro), ...facts.map(p), p(cta), link(input.url)]),
  };
}

export function requestNotSelectedEmail(locale: Locale, input: { title: string; url: string }): Email {
  const tr = translator(locale);
  const body = tr("email.requestNotSelected.body", { title: input.title });
  const cta = tr("email.requestNotSelected.cta");
  return { subject: tr("email.requestNotSelected.subject", { title: input.title }), text: `${body}\n\n${cta}\n${input.url}`, html: wrap(locale, [p(body), p(cta), link(input.url)]) };
}

export function requestRejectedEmail(locale: Locale, input: { title: string; reason: string; url: string }): Email {
  const tr = translator(locale);
  const intro = tr("email.requestRejected.intro", { title: input.title });
  const label = tr("email.requestRejected.reason");
  const cta = tr("email.requestRejected.cta");
  return {
    subject: tr("email.requestRejected.subject", { title: input.title }),
    text: `${intro}\n\n${label}\n${input.reason}\n\n${cta}\n${input.url}`,
    html: wrap(locale, [p(intro), p(label), quote(input.reason), p(cta), link(input.url)]),
  };
}

export function requestExpiredEmail(locale: Locale, input: { title: string; days: number; url: string }): Email {
  const tr = translator(locale);
  const body = tr("email.requestExpired.body", { title: input.title, days: input.days });
  const cta = tr("email.requestExpired.cta");
  return { subject: tr("email.requestExpired.subject", { title: input.title }), text: `${body}\n\n${cta}\n${input.url}`, html: wrap(locale, [p(body), p(cta), link(input.url)]) };
}

/** Internal alert for ADMIN_EMAILS (English only, like inquiryAdminAlertEmail). The client's e-mail is on the admin page, not here. */
export function requestAdminNewEmail(
  input: { title: string; category: Category; budgetBand: BudgetBand; languages: readonly string[]; clientName: string },
  url: string,
): Email {
  const tr = translator("en");
  const lines = [`From: ${input.clientName}`, `Category: ${tr(CATEGORY_KEY[input.category])}`, `Budget: ${tr(BUDGET_KEY[input.budgetBand])}`, `Languages: ${input.languages.join(", ")}`];
  const intro = `A new request is waiting for your review: “${input.title}”.`;
  return { subject: `New request: ${input.title}`, text: `${intro}\n${lines.join("\n")}\n\n${url}`, html: wrap("en", [p(intro), ...lines.map(p), link(url)]) };
}

/** To the chosen builder: the client's typed name only; the request and the proposal come as the inquiry's first message. */
export function requestSelectedEmail(locale: Locale, input: { clientName: BuilderFacingName; title: string; body: string; url: string }): Email {
  const tr = translator(locale);
  const intro = tr("email.requestSelected.intro", { client: input.clientName, title: input.title });
  const cta = tr("email.requestSelected.cta");
  return {
    subject: tr("email.requestSelected.subject", { client: input.clientName }),
    text: `${intro}\n\n${input.body}\n\n${cta}\n${input.url}`,
    html: wrap(locale, [p(intro), quote(input.body), p(cta), link(input.url)]),
  };
}
