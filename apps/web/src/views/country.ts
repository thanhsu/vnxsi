import { COUNTRY_CODES } from "../domain/countries.ts";
import type { Locale } from "../i18n/locales.ts";

const namers = new Map<Locale, Intl.DisplayNames>();
const options = new Map<Locale, { code: string; name: string }[]>();

export function countryName(locale: Locale, code: string): string {
  let namer = namers.get(locale);
  if (!namer) {
    namer = new Intl.DisplayNames([locale], { type: "region" });
    namers.set(locale, namer);
  }
  return namer.of(code) ?? code;
}

/** All countries sorted by their name in `locale`. */
export function countryOptions(locale: Locale): { code: string; name: string }[] {
  let list = options.get(locale);
  if (!list) {
    list = COUNTRY_CODES.map((code) => ({ code, name: countryName(locale, code) })).sort((a, b) => a.name.localeCompare(b.name, locale));
    options.set(locale, list);
  }
  return list;
}
