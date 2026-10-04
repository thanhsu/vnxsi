import type { Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { escapeHtml } from "../escape.ts";

type Email = { subject: string; text: string; html: string };

const p = (text: string) => `<p>${escapeHtml(text)}</p>`;
const link = (href: string) => `<p><a href="${escapeHtml(href)}">${escapeHtml(href)}</a></p>`;
const quote = (text: string) => `<blockquote style="white-space:pre-line;border-left:3px solid #DCE0E6;margin:0;padding-left:12px">${escapeHtml(text)}</blockquote>`;

function wrap(locale: Locale, parts: string[]): string {
  return `<!doctype html><html lang="${locale}"><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0D1526">${parts.join("")}</body></html>`;
}

export function builderApprovedEmail(locale: Locale, input: { name: string; profileUrl: string; hubUrl: string }): Email {
  const tr = translator(locale);
  const body = tr("email.builderApproved.body", { name: input.name });
  const cta = tr("email.builderApproved.cta");
  return {
    subject: tr("email.builderApproved.subject"),
    text: `${body}\n${input.profileUrl}\n\n${cta}\n${input.hubUrl}`,
    html: wrap(locale, [p(body), link(input.profileUrl), p(cta), link(input.hubUrl)]),
  };
}

export function builderRejectedEmail(locale: Locale, input: { name: string; reason: string; profileUrl: string }): Email {
  const tr = translator(locale);
  const body = tr("email.builderRejected.body", { name: input.name });
  const cta = tr("email.builderRejected.cta");
  return {
    subject: tr("email.builderRejected.subject"),
    text: `${body}\n\n${input.reason}\n\n${cta}\n${input.profileUrl}`,
    html: wrap(locale, [p(body), quote(input.reason), p(cta), link(input.profileUrl)]),
  };
}
