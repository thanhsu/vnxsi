import type { FC, PropsWithChildren } from "hono/jsx";
import { alternates, LOCALE_LABEL, LOCALES, localizedPath, type Locale } from "../i18n/locales.ts";
import { translator, type Translate } from "../i18n/t.ts";
import { CONTACT_EMAIL } from "../domain/feedback.ts";
import type { MessageKey } from "../i18n/messages/en.ts";
import { jsonLdScript } from "./json-ld.ts";
import { PRIVACY_NOTICE_SCRIPT, PrivacyNotice, privacyNoticeDate } from "./privacy-notice.tsx";

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
  /** Full-width <main> for pages that lay out their own bands (the landing page); others keep the centred container. */
  fullWidth?: boolean;
  /** Same-origin scripts, loaded with defer (VNX-0709: only the landing page has one). */
  scripts?: readonly string[];
};

/** Only these two faces are preloaded (plan VNX-0709 §1); the others load on demand through unicode-range. */
const PRELOAD_FONTS = ["/assets/fonts/space-grotesk-latin-700-normal.woff2", "/assets/fonts/be-vietnam-pro-latin-400-normal.woff2"];

/** Signed-out visitors sign in first and land on the builder application (spec §5.3). */
export function builderCtaHref(locale: Locale, signedIn: boolean): string {
  if (signedIn) return localizedPath(locale, "/hub");
  return `${localizedPath(locale, "/login")}?next=${encodeURIComponent(localizedPath(locale, "/hub/apply"))}`;
}

/** "/#how" in the page's locale. */
const anchorOn = (locale: Locale, path: string, hash: string) => `${localizedPath(locale, path)}#${hash}`;

/** Logo Option B, inline so its colours follow the theme (light and dark tokens in app.css). */
export const BrandMark: FC<{ size: number }> = ({ size }) => (
  <svg class="brand-mark" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false">
    <path class="bm-line" d="M14 16 L32 48 L50 16" fill="none" stroke="#0D1526" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
    <circle class="bm-node" cx="14" cy="16" r="6.5" fill="#FFFFFF" stroke="#0D1526" stroke-width="4" />
    <circle class="bm-node" cx="50" cy="16" r="6.5" fill="#FFFFFF" stroke="#0D1526" stroke-width="4" />
    <circle class="bm-dot" cx="32" cy="48" r="8" fill="#1D4ED8" />
  </svg>
);

const Brand: FC<{ locale: Locale; size: number }> = ({ locale, size }) => (
  <a class="brand" href={localizedPath(locale, "/")}>
    <BrandMark size={size} />
    <span class="brand-word">
      VNX<span class="brand-dot">.</span>SI
    </span>
  </a>
);

const GlobeIcon: FC = () => (
  <svg class="icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
  </svg>
);

const ChevronIcon: FC = () => (
  <svg class="icon chevron" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

const MenuIcon: FC = () => (
  <svg class="icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
    <path class="menu-open" d="M4 7h16M4 12h16M4 17h16" />
    <path class="menu-close" d="M6 6l12 12M18 6L6 18" />
  </svg>
);

type NavItem = { href: string; key: MessageKey; current: boolean };

function mainNav(locale: Locale, rest: string): NavItem[] {
  return [
    { href: localizedPath(locale, "/products"), key: "nav.products", current: rest === "/products" },
    { href: localizedPath(locale, "/builders"), key: "nav.findBuilders", current: rest === "/builders" },
    { href: anchorOn(locale, "/", "how"), key: "nav.howItWorks", current: false },
    { href: localizedPath(locale, "/for-builders"), key: "nav.forBuilders", current: rest === "/for-builders" },
    { href: localizedPath(locale, "/contact"), key: "nav.contact", current: rest === "/contact" },
  ];
}

const NavLinks: FC<{ items: NavItem[]; tr: Translate }> = ({ items, tr }) => (
  <>
    {items.map((item) => (
      <a href={item.href} aria-current={item.current ? "page" : undefined}>
        {tr(item.key)}
      </a>
    ))}
  </>
);

/** The four locales, each pointing at the page being viewed. */
const LangLinks: FC<{ locale: Locale; rest: string }> = ({ locale, rest }) => (
  <>
    {LOCALES.map((l) => (
      <a href={localizedPath(l, rest)} hreflang={l} lang={l} aria-current={l === locale ? "true" : undefined}>
        {LOCALE_LABEL[l]}
      </a>
    ))}
  </>
);

/** Sign in + CTA, or My inquiries + Builder Hub + sign out. */
const Account: FC<{ locale: Locale; signedIn: boolean; tr: Translate }> = ({ locale, signedIn, tr }) =>
  signedIn ? (
    <>
      <a class="nav-account" href={localizedPath(locale, "/me")}>{tr("nav.me")}</a>
      <a class="nav-account" href={localizedPath(locale, "/hub")}>{tr("nav.hub")}</a>
      <form method="post" action="/logout" class="signout">
        <button type="submit" class="btn btn-ghost">
          {tr("nav.signOut")}
        </button>
      </form>
    </>
  ) : (
    <>
      <a class="nav-account" href={localizedPath(locale, "/login")}>{tr("nav.signIn")}</a>
      <a class="btn btn-primary" href={builderCtaHref(locale, false)}>
        {tr("nav.becomeBuilder")}
      </a>
    </>
  );

export const Layout: FC<PropsWithChildren<LayoutProps>> = (props) => {
  const { locale, title, origin, rest, description, noindex, signedIn, ogImage, jsonLd, fullWidth, scripts, children } = props;
  const tr = translator(locale);
  const canonical = origin + localizedPath(locale, rest);
  const nav = mainNav(locale, rest);
  const isSignedIn = signedIn === true;
  const noticeDate = privacyNoticeDate(locale, isSignedIn);
  const pageScripts = [...new Set([...(scripts ?? []), ...(noticeDate !== null ? [PRIVACY_NOTICE_SCRIPT] : [])])];
  const notice = noticeDate !== null ? <PrivacyNotice locale={locale} date={noticeDate} tr={tr} /> : null;
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
        {PRELOAD_FONTS.map((href) => (
          <link rel="preload" href={href} as="font" type="font/woff2" crossorigin="anonymous" />
        ))}
        <link rel="stylesheet" href="/assets/app.css" />
        <link rel="icon" type="image/svg+xml" href="/assets/brand/vnxsi-icon.svg" />
        {pageScripts.map((src) => (
          <script src={src} defer></script>
        ))}
      </head>
      <body>
        <a class="skip-link" href="#main">
          {tr("a11y.skipToContent")}
        </a>
        <header class="site-header">
          <div class="container bar">
            <Brand locale={locale} size={30} />
            <nav class="site-nav" aria-label={tr("nav.menu")}>
              <NavLinks items={nav} tr={tr} />
            </nav>
            <div class="site-actions">
              <details class="lang-menu">
                <summary>
                  <GlobeIcon />
                  <span class="visually-hidden">{tr("nav.language")}: </span>
                  <span>{LOCALE_LABEL[locale]}</span>
                  <ChevronIcon />
                </summary>
                <div class="lang-list">
                  <LangLinks locale={locale} rest={rest} />
                </div>
              </details>
              <Account locale={locale} signedIn={isSignedIn} tr={tr} />
            </div>
            <details class="menu">
              <summary aria-label={tr("nav.menu")}>
                <MenuIcon />
              </summary>
              <div class="menu-panel">
                <nav class="menu-nav" aria-label={tr("nav.menu")}>
                  <NavLinks items={nav} tr={tr} />
                </nav>
                <div class="menu-lang" role="group" aria-label={tr("nav.language")}>
                  <LangLinks locale={locale} rest={rest} />
                </div>
                <div class="menu-account">
                  <Account locale={locale} signedIn={isSignedIn} tr={tr} />
                </div>
              </div>
            </details>
          </div>
        </header>
        <main id="main" class={fullWidth ? "page-full" : "container"}>
          {notice !== null && fullWidth ? <div class="container">{notice}</div> : notice}
          {children}
        </main>
        <footer class="site-footer">
          <div class="container footer-grid">
            <div class="footer-brand">
              <Brand locale={locale} size={28} />
              <p class="tagline">{tr("site.tagline")}</p>
              <p class="footer-note">{tr("site.rankings")}</p>
            </div>
            <nav class="footer-nav" aria-label={tr("footer.marketplace")}>
              <p class="footer-h" aria-hidden="true">{tr("footer.marketplace")}</p>
              <a href={localizedPath(locale, "/products")}>{tr("nav.products")}</a>
              <a href={localizedPath(locale, "/builders")}>{tr("nav.findBuilders")}</a>
              <a href={anchorOn(locale, "/", "how")}>{tr("nav.howItWorks")}</a>
            </nav>
            <nav class="footer-nav" aria-label={tr("footer.builders")}>
              <p class="footer-h" aria-hidden="true">{tr("footer.builders")}</p>
              {isSignedIn ? (
                <a href={localizedPath(locale, "/hub")}>{tr("nav.hub")}</a>
              ) : (
                <>
                  <a href={builderCtaHref(locale, false)}>{tr("nav.becomeBuilder")}</a>
                  <a href={localizedPath(locale, "/login")}>{tr("nav.signIn")}</a>
                </>
              )}
            </nav>
            <nav class="footer-nav" aria-label={tr("footer.company")}>
              <p class="footer-h" aria-hidden="true">{tr("footer.company")}</p>
              <a href={localizedPath(locale, "/media-kit")}>{tr("footer.mediaKit")}</a>
              <a href={localizedPath(locale, "/contact")}>{tr("nav.contact")}</a>
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
              <a href={localizedPath(locale, "/terms")}>{tr("footer.terms")}</a>
              <a href={localizedPath(locale, "/privacy")}>{tr("footer.privacy")}</a>
              <a href={localizedPath(locale, "/disclosure")}>{tr("footer.disclosure")}</a>
            </nav>
          </div>
          <div class="container footer-bottom">
            <p>© {new Date().getUTCFullYear()} VNX.SI</p>
            <nav class="footer-lang" aria-label={tr("nav.language")}>
              <LangLinks locale={locale} rest={rest} />
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
};
