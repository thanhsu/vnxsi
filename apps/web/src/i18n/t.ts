import type { Locale } from "./locales.ts";
import { en, type MessageKey, type Messages } from "./messages/en.ts";
import { vi } from "./messages/vi.ts";
import { zhHans } from "./messages/zh-hans.ts";
import { zhHant } from "./messages/zh-hant.ts";

const CATALOG: Record<Locale, Messages> = { en, vi, "zh-Hans": zhHans, "zh-Hant": zhHant };

export type Params = Record<string, string | number>;

export function t(locale: Locale, key: MessageKey, params?: Params): string {
  const raw = CATALOG[locale][key] || en[key];
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

export function translator(locale: Locale) {
  return (key: MessageKey, params?: Params) => t(locale, key, params);
}

export type Translate = ReturnType<typeof translator>;
