import type { Locale } from "../i18n/locales.ts";

/** Whole US dollars in the viewer's locale (spec §4: USD only, stored as cents). */
export function formatUsd(locale: Locale, cents: number): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}
