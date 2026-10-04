import type { FC, PropsWithChildren } from "hono/jsx";
import { alternates, LOCALE_LABEL, LOCALES, localizedPath, type Locale } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import { jsonLdScript } from "./json-ld.ts";

export type LayoutProps = {
  locale: Locale;
  title: string;
  origin: string;
  rest: string;
  description?: string;
  noindex?: boolean;
  signedIn?: boolean;
  ogImage?: string;
  jsonLd?: unknown;
};

export const Layout: FC<PropsWithChildren<LayoutProps>> = (props) => {
  const { locale, title, origin, rest, description, noindex, signedIn, ogImage, jsonLd, children } = props;
  const tr = translator(locale);
  const canonical = origin + localizedPath(locale, rest);
  return (
    <html lang={locale}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        {description ? <meta name="description" content={description} /> : null}
        {noindex ? <meta name="robots" content="noindex" /> : null}
        {noindex ? null : <link rel="canonical" href={canonical} />}
        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        {noindex ? null : <meta property="og:url" content={canonical} />}
        {description ? <meta property="og:description" content={description} /> : null}
        {ogImage ? <meta property="og:image" content={ogImage} /> : null}
        {jsonLd ? jsonLdScript(jsonLd) : null}
        {/* A noindex page has no canonical form to point at (spec §5.1 hreflang is for public pages). */}
        {noindex
          ? null
          : alternates(origin, rest).map((alt) => <link rel="alternate" hreflang={alt.hreflang} href={alt.href} />)}
        <link rel="stylesheet" href="/assets/app.css" />
      </head>
      <body>
        <header class="site-header">
          <div class="container bar">
            <a class="brand" href={localizedPath(locale, "/")}>
              VNX.SI
            </a>
            <nav class="lang" aria-label={tr("nav.language")}>
              {LOCALES.map((l) => (
                <a href={localizedPath(l, rest)} hreflang={l} lang={l} aria-current={l === locale ? "true" : undefined}>
                  {LOCALE_LABEL[l]}
                </a>
              ))}
            </nav>
            {signedIn ? (
              <>
                <a href={localizedPath(locale, "/hub")}>{tr("nav.hub")}</a>
                <form method="post" action="/logout">
                  <button type="submit" class="link">
                    {tr("nav.signOut")}
                  </button>
                </form>
              </>
            ) : (
              <a href={localizedPath(locale, "/login")}>{tr("nav.signIn")}</a>
            )}
          </div>
        </header>
        <main id="main" class="container">
          {children}
        </main>
        <footer class="site-footer">
          <div class="container">{tr("site.tagline")}</div>
        </footer>
      </body>
    </html>
  );
};
