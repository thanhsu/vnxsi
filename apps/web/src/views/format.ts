import type { Locale } from "../i18n/locales.ts";

/** Whole US dollars in the viewer's locale (spec §4: USD only, stored as cents). */
export function formatUsd(locale: Locale, cents: number): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

const PERCENT = 100;
const round = (n: number): number => Math.round(n * 10) / 10;

export const formatCount = (locale: Locale, n: number): string => new Intl.NumberFormat(locale).format(n);
/** A whole percent change with its sign ("+25%"); zero has none. */
export const formatChange = (locale: Locale, pct: number): string => new Intl.NumberFormat(locale, { style: "percent", signDisplay: "exceptZero" }).format(pct / PERCENT);

/** A 14-day sparkline drawn as one polyline in a fixed box; the stroke lives in CSS. */
const SPARK = { width: 112, height: 32, pad: 2 } as const;
export const SPARK_VIEWBOX = `0 0 ${SPARK.width} ${SPARK.height}`;
export function sparkPoints(values: readonly number[]): string {
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? (SPARK.width - 2 * SPARK.pad) / (values.length - 1) : 0;
  return values.map((v, i) => `${round(SPARK.pad + i * step)},${round(SPARK.height - SPARK.pad - (v / max) * (SPARK.height - 2 * SPARK.pad))}`).join(" ");
}

const MS = { day: 86_400_000, hour: 3_600_000, minute: 60_000 } as const;

/** "2 hours ago": the largest whole unit between `iso` and `now` (the viewer's locale). */
export function relativeTime(locale: Locale, iso: string, now: Date): string {
  const diff = Date.parse(iso) - now.getTime();
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const unit of ["day", "hour", "minute"] as const) if (Math.abs(diff) >= MS[unit]) return rtf.format(Math.trunc(diff / MS[unit]), unit);
  return rtf.format(0, "minute");
}

/** A median reply time given in minutes, shown in the largest whole unit ("10 min", "2 hr", "3 days"). */
export function formatDuration(locale: Locale, minutes: number): string {
  const unit = minutes * MS.minute >= MS.day ? "day" : minutes * MS.minute >= MS.hour ? "hour" : "minute";
  return new Intl.NumberFormat(locale, { style: "unit", unit, unitDisplay: "short" }).format(Math.floor((minutes * MS.minute) / MS[unit]));
}
