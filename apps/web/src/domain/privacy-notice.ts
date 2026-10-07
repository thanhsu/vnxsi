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

export type PrivacyVersion = "current" | "m7";

/** `"m7"` from the start of the notice window (go-live - 14 UTC days, inclusive) for ever after; `"current"` before it, or for an unset or malformed value. Never go back: the value is not cleared after go-live. */
export function privacyVersion(goLive: string | undefined, now: Date): PrivacyVersion {
  const date = parsePrivacyNoticeDate(goLive);
  const at = now.getTime();
  if (!date || !Number.isFinite(at)) return "current";
  return at >= date.getTime() - 14 * DAY_MS ? "m7" : "current";
}

/** The counting gate (Owner 2026-10-06): view counting and the visitor cookie start at go-live 00:00 UTC and never switch off. False for an unset or malformed value. */
export function isCountingLive(goLive: string | undefined, now: Date): boolean {
  const date = parsePrivacyNoticeDate(goLive);
  const at = now.getTime();
  return date !== null && Number.isFinite(at) && at >= date.getTime();
}

export function formatPrivacyNoticeDate(goLive: string | undefined, locale: Locale): string | null {
  const date = parsePrivacyNoticeDate(goLive);
  return date
    ? new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(date)
    : null;
}
