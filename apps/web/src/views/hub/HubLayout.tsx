import type { FC, PropsWithChildren } from "hono/jsx";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator } from "../../i18n/t.ts";
import { Layout } from "../Layout.tsx";

export type HubSection = "overview" | "profile" | "portfolio" | "products" | "inquiries" | "invitations";

const NAV: { key: HubSection; path: string; label: MessageKey }[] = [
  { key: "overview", path: "/hub", label: "hub.nav.overview" },
  { key: "profile", path: "/hub/profile", label: "hub.nav.profile" },
  { key: "portfolio", path: "/hub/portfolio", label: "hub.nav.portfolio" },
  { key: "products", path: "/hub/products", label: "hub.nav.products" },
  { key: "inquiries", path: "/hub/inquiries", label: "hub.nav.inquiries" },
  { key: "invitations", path: "/hub/invitations", label: "hub.nav.invitations" },
];

export const HubLayout: FC<PropsWithChildren<{ locale: Locale; origin: string; title: string; rest: string; active: HubSection; invalid?: boolean }>> = (p) => {
  const tr = translator(p.locale);
  return (
    <Layout locale={p.locale} title={`${p.title} · ${tr("hub.title")}`} origin={p.origin} rest={p.rest} noindex signedIn invalid={p.invalid}>
      <nav class="subnav" aria-label={tr("hub.nav.label")}>
        {NAV.map((item) => (
          <a href={localizedPath(p.locale, item.path)} aria-current={item.key === p.active ? "page" : undefined}>
            {tr(item.label)}
          </a>
        ))}
      </nav>
      {p.children}
    </Layout>
  );
};
