import type { FC, PropsWithChildren } from "hono/jsx";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator } from "../../i18n/t.ts";
import { Layout } from "../Layout.tsx";

export type AdminSection = "builders" | "products" | "inquiries" | "requests" | "invites" | "users";

const NAV: { key: AdminSection; path: string; label: MessageKey }[] = [
  { key: "builders", path: "/admin/builders", label: "admin.nav.builders" },
  { key: "products", path: "/admin/products", label: "admin.nav.products" },
  { key: "inquiries", path: "/admin/inquiries", label: "admin.nav.inquiries" },
  { key: "requests", path: "/admin/requests", label: "admin.nav.requests" },
  { key: "invites", path: "/admin/invites", label: "admin.nav.invites" },
  { key: "users", path: "/admin/users", label: "admin.nav.users" },
];

export const AdminLayout: FC<PropsWithChildren<{ locale: Locale; origin: string; title: string; rest: string; active: AdminSection }>> = (p) => {
  const tr = translator(p.locale);
  return (
    <Layout locale={p.locale} title={`${p.title} · ${tr("admin.title")}`} origin={p.origin} rest={p.rest} noindex signedIn>
      <nav class="subnav" aria-label={tr("admin.nav.label")}>
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
