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
