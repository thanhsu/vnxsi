export const LOCALES = ["en", "vi", "zh-Hans", "zh-Hant"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

const PREFIX: Record<Locale, string> = { en: "", vi: "/vi", "zh-Hans": "/zh-hans", "zh-Hant": "/zh-hant" };

export const LOCALE_LABEL: Record<Locale, string> = { en: "EN", vi: "VI", "zh-Hans": "简体", "zh-Hant": "繁體" };

export function isLocale(value: unknown): value is Locale {
  return (LOCALES as readonly unknown[]).includes(value);
}

// A rest starting with "//" would render as a protocol-relative (off-site) link.
function collapseSlashes(rest: string): string {
  return rest.replace(/^\/+/, "/");
}

export function localeFromPath(pathname: string): { locale: Locale; rest: string } {
  for (const locale of LOCALES) {
    const prefix = PREFIX[locale];
    if (!prefix) continue;
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      return { locale, rest: collapseSlashes(pathname.slice(prefix.length) || "/") };
    }
  }
  return { locale: DEFAULT_LOCALE, rest: collapseSlashes(pathname) };
}

export function localizedPath(locale: Locale, path: string): string {
  const clean = path.startsWith("/") ? path : "/" + path;
  const prefix = PREFIX[locale];
  if (!prefix) return clean;
  return clean === "/" ? prefix + "/" : prefix + clean;
}

export function alternates(origin: string, rest: string): { hreflang: string; href: string }[] {
  return [
    ...LOCALES.map((locale) => ({ hreflang: locale as string, href: origin + localizedPath(locale, rest) })),
    { hreflang: "x-default", href: origin + localizedPath(DEFAULT_LOCALE, rest) },
  ];
}
