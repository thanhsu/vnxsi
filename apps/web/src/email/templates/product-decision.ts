import type { Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { escapeHtml } from "../escape.ts";

type Email = { subject: string; text: string; html: string };

const p = (text: string) => `<p>${escapeHtml(text)}</p>`;
const link = (href: string) => `<p><a href="${escapeHtml(href)}">${escapeHtml(href)}</a></p>`;
const quote = (text: string) => `<blockquote style="white-space:pre-line;border-left:3px solid #DCE0E6;margin:0;padding-left:12px">${escapeHtml(text)}</blockquote>`;
const wrap = (locale: Locale, parts: string[]) =>
  `<!doctype html><html lang="${locale}"><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0D1526">${parts.join("")}</body></html>`;

export function productApprovedEmail(locale: Locale, input: { name: string; productUrl: string; hubUrl: string }): Email {
  const tr = translator(locale);
  const body = tr("email.productApproved.body", { name: input.name });
  const cta = tr("email.productApproved.cta");
  return {
    subject: tr("email.productApproved.subject"),
    text: `${body}\n${input.productUrl}\n\n${cta}\n${input.hubUrl}`,
    html: wrap(locale, [p(body), link(input.productUrl), p(cta), link(input.hubUrl)]),
  };
}

export function productChangesEmail(locale: Locale, input: { name: string; note: string; editUrl: string }): Email {
  const tr = translator(locale);
  const body = tr("email.productChanges.body", { name: input.name });
  const cta = tr("email.productChanges.cta");
  return {
    subject: tr("email.productChanges.subject"),
    text: `${body}\n\n${input.note}\n\n${cta}\n${input.editUrl}`,
    html: wrap(locale, [p(body), quote(input.note), p(cta), link(input.editUrl)]),
  };
}
