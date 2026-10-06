import type { Locale } from "../i18n/locales.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parsePrivacyNoticeDate(raw: string | undefined): Date | null {
  if (!raw || !DATE.test(raw)) return null;
  const time = Date.parse(`${raw}T00:00:00.000Z`);
  if (!Number.isFinite(time)) return null;
  const date = new Date(time);
  return date.toISOString().slice(0, 10) === raw ? date : null;
}

export function shouldShowPrivacyNotice(goLive: string | undefined, now: Date): boolean {
  const date = parsePrivacyNoticeDate(goLive);
  const at = now.getTime();
  if (!date || !Number.isFinite(at)) return false;
  return at >= date.getTime() - 14 * DAY_MS && at < date.getTime() + 31 * DAY_MS;
}

export function formatPrivacyNoticeDate(goLive: string | undefined, locale: Locale): string | null {
  const date = parsePrivacyNoticeDate(goLive);
  return date
    ? new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(date)
    : null;
}
