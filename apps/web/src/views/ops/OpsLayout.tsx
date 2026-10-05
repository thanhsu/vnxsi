import type { FC, PropsWithChildren } from "hono/jsx";
import type { OpsRole } from "../../domain/ops.ts";
import type { OpsMessageKey } from "../../i18n/messages/en.ts";
import { t } from "../../i18n/t.ts";
import type { OpsIcon, VisibleGroup } from "../../ops/menu.ts";
import { BrandMark } from "../Layout.tsx";

/**
 * The Ops console shell (VNX-2503; spec §2, §7.2; mockups OpsOverview / OpsOverviewMobile). English only, noindex, no
 * public header or footer, no canonical or hreflang. A 240 px sidebar on wide screens; below 1024 px the same menu sits
 * in a <details> control (no JS). Nothing inline: every style lives in app.css under .ops-* (CSP, VNX-0803).
 */

export type OpsEnvironment = "production" | "local";

export interface OpsShell {
  role: OpsRole;
  email: string;
  environment: OpsEnvironment;
  menu: VisibleGroup[];
}

export type OpsLayoutProps = OpsShell & {
  /** The page name: the <title> prefix and the last breadcrumb. */
  page: string;
  /** Breadcrumbs between "Ops" and the page, such as the menu group. */
  trail?: string[];
};

const tr = (key: OpsMessageKey, params?: Record<string, string | number>) => t("en", key, params);

const ROLE_LABEL: Record<OpsRole, OpsMessageKey> = { owner: "ops.role.owner", operator: "ops.role.operator", content: "ops.role.content", viewer: "ops.role.viewer" };
const ENV_LABEL: Record<OpsEnvironment, OpsMessageKey> = { production: "ops.env.production", local: "ops.env.local" };

/** Line icons, 16 px, drawn in currentColor by .ops-icon. */
const ICON_PATHS: Record<OpsIcon, string> = {
  overview: "M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z",
  builders: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c1.5-4 4.5-6 8-6s6.5 2 8 6",
};

const NavIcon: FC<{ icon: OpsIcon }> = ({ icon }) => (
  <svg class="ops-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
    <path d={ICON_PATHS[icon]} />
  </svg>
);

const MenuIcon: FC = () => (
  <svg class="ops-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
    <path class="ops-menu-open" d="M4 7h16M4 12h16M4 17h16" />
    <path class="ops-menu-close" d="M6 6l12 12M18 6L6 18" />
  </svg>
);

const Brand: FC<{ extra?: string }> = ({ extra }) => (
  <a class={extra ? `ops-brand ${extra}` : "ops-brand"} href="/ops">
    <BrandMark size={24} />
    <span class="ops-brand-word">
      VNX<span class="brand-dot">.</span>SI
    </span>
    <span class="ops-tag">{tr("ops.layout.tag")}</span>
  </a>
);

/** The sidebar list. Rendered twice (wide sidebar, narrow menu); only one is ever displayed. */
const OpsNav: FC<{ menu: VisibleGroup[]; idPrefix: string }> = ({ menu, idPrefix }) => (
  <nav class="ops-nav" aria-label={tr("ops.layout.nav")}>
    {menu.map((g) => {
      const headingId = g.labelKey ? `${idPrefix}-${g.group}` : undefined;
      return (
        <div class="ops-group" role={headingId ? "group" : undefined} aria-labelledby={headingId}>
          {g.labelKey ? (
            <p class="ops-group-h" id={headingId}>
              {tr(g.labelKey)}
            </p>
          ) : null}
          {g.items.map((item) => (
            <a class="ops-nav-link" href={item.path} aria-current={item.current ? "page" : undefined}>
              <NavIcon icon={item.icon} />
              {tr(item.labelKey)}
              {item.count ? (
                <span class="ops-nav-n">
                  <span class="visually-hidden">{tr("ops.nav.waiting")}</span>
                  {item.count}
                </span>
              ) : null}
            </a>
          ))}
        </div>
      );
    })}
  </nav>
);

const Who: FC<{ role: OpsRole; email: string }> = ({ role, email }) => (
  <>
    <span class="ops-role">
      <span class="visually-hidden">{tr("ops.layout.role")} </span>
      {tr(ROLE_LABEL[role])}
    </span>
    <span class="ops-who">
      <span class="visually-hidden">{tr("ops.layout.signedInAs")} </span>
      {email}
    </span>
    <form method="post" action="/logout" class="ops-signout">
      <button type="submit" class="ops-btn">
        {tr("ops.layout.signOut")}
      </button>
    </form>
  </>
);

const Sep: FC = () => (
  <span class="ops-crumb-sep" aria-hidden="true">
    /
  </span>
);

export const OpsLayout: FC<PropsWithChildren<OpsLayoutProps>> = ({ page, trail = [], role, email, environment, menu, children }) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{tr("ops.layout.title", { page })}</title>
      <meta name="robots" content="noindex, nofollow" />
      <link rel="preload" href="/assets/fonts/be-vietnam-pro-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin="anonymous" />
      <link rel="stylesheet" href="/assets/app.css" />
      <link rel="icon" type="image/svg+xml" href="/assets/brand/vnxsi-icon.svg" />
    </head>
    <body class="ops-body">
      <a class="ops-skip" href="#ops-main">
        {tr("ops.layout.skip")}
      </a>
      <div class="ops-app">
        <aside class="ops-side">
          <Brand />
          <OpsNav menu={menu} idPrefix="ops-side" />
        </aside>
        <div class="ops-main">
          <header class="ops-top">
            <Brand extra="ops-top-brand" />
            <nav class="ops-crumb" aria-label={tr("ops.layout.breadcrumb")}>
              <span>{tr("ops.layout.crumbRoot")}</span>
              <Sep />
              {trail.map((crumb) => (
                <>
                  <span>{crumb}</span>
                  <Sep />
                </>
              ))}
              <span aria-current="page">{page}</span>
            </nav>
            <span class={`ops-env ops-env-${environment}`}>
              <span class="visually-hidden">{tr("ops.layout.environment")} </span>
              {tr(ENV_LABEL[environment])}
            </span>
            <div class="ops-account">
              <Who role={role} email={email} />
            </div>
            <details class="ops-menu">
              <summary aria-label={tr("ops.layout.menu")}>
                <MenuIcon />
              </summary>
              <div class="ops-menu-panel">
                <OpsNav menu={menu} idPrefix="ops-menu" />
                <div class="ops-menu-account">
                  <Who role={role} email={email} />
                </div>
              </div>
            </details>
          </header>
          <main id="ops-main" class="ops-page" tabindex={-1}>
            {children}
          </main>
        </div>
      </div>
    </body>
  </html>
);
