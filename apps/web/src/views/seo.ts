import { alternates, LOCALES, localizedPath } from "../i18n/locales.ts";

/** One page of the site. A localized page is listed once per locale, each with every alternate (spec §8.8). */
export type SitemapEntry = { rest: string; lastmod?: string; localized: boolean };

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export function renderSitemap(origin: string, entries: SitemapEntry[]): string {
  const urls: string[] = [];
  for (const entry of entries) {
    const lastmod = entry.lastmod ? `<lastmod>${xml(entry.lastmod.slice(0, 10))}</lastmod>` : "";
    if (!entry.localized) {
      urls.push(`<url><loc>${xml(origin + entry.rest)}</loc>${lastmod}</url>`);
      continue;
    }
    const links = alternates(origin, entry.rest)
      .map((a) => `<xhtml:link rel="alternate" hreflang="${xml(a.hreflang)}" href="${xml(a.href)}"/>`)
      .join("");
    for (const locale of LOCALES) urls.push(`<url><loc>${xml(origin + localizedPath(locale, entry.rest))}</loc>${lastmod}${links}</url>`);
  }
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
}

/** Spec §8.8: private areas are blocked in every locale; product images stay crawlable for og:image (Owner 2026-10-04). */
const PRIVATE = ["/hub", "/me", "/admin", "/auth"];

export function renderRobots(origin: string): string {
  const disallow = new Set<string>();
  for (const locale of LOCALES) for (const path of PRIVATE) disallow.add(localizedPath(locale, path));
  return [
    "User-agent: *",
    "Allow: /media/products/",
    "Disallow: /media",
    // Outbound-click redirects (monetization addendum, spec §8.8); no locale prefix.
    "Disallow: /go/",
    ...[...disallow].map((p) => `Disallow: ${p}`),
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");
}
