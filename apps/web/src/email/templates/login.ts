import type { Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { escapeHtml } from "../escape.ts";

export function loginEmail(locale: Locale, link: string): { subject: string; text: string; html: string } {
  const tr = translator(locale);
  const intro = tr("email.login.intro");
  const ignore = tr("email.login.ignore");
  const safeLink = escapeHtml(link);
  return {
    subject: tr("email.login.subject"),
    text: `${intro}\n\n${link}\n\n${ignore}`,
    html:
      `<!doctype html><html lang="${locale}"><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0D1526">` +
      `<p>${escapeHtml(intro)}</p><p><a href="${safeLink}">${safeLink}</a></p>` +
      `<p style="color:#5B6475">${escapeHtml(ignore)}</p></body></html>`,
  };
}
