import type { FC } from "hono/jsx";
import { BUILDER_STATUSES, type BuilderAccount, type BuilderStatus } from "../../domain/builder.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { countryName } from "../country.ts";
import { STATUS_KEY } from "../labels.ts";
import { AdminLayout } from "./AdminLayout.tsx";

export const BuildersPage: FC<{ locale: Locale; origin: string; status: BuilderStatus; builders: BuilderAccount[] }> = (p) => {
  const tr = translator(p.locale);
  return (
    <AdminLayout locale={p.locale} origin={p.origin} title={tr("admin.nav.builders")} rest="/admin/builders" active="builders">
      <h1>{tr("admin.nav.builders")}</h1>
      <nav class="subnav" aria-label={tr("admin.builders.filter")}>
        {BUILDER_STATUSES.map((s) => (
          <a href={localizedPath(p.locale, `/admin/builders?status=${s}`)} aria-current={s === p.status ? "page" : undefined}>
            {tr(STATUS_KEY[s])}
          </a>
        ))}
      </nav>
      {p.builders.length === 0 ? (
        <p class="muted">{tr("admin.builders.empty")}</p>
      ) : (
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>{tr("admin.col.handle")}</th>
                <th>{tr("admin.col.name")}</th>
                <th>{tr("admin.col.email")}</th>
                <th>{tr("admin.col.country")}</th>
                <th>{tr("admin.col.created")}</th>
                <th>{tr("admin.col.invite")}</th>
              </tr>
            </thead>
            <tbody>
              {p.builders.map((b) => (
                <tr>
                  <td>
                    <a href={localizedPath(p.locale, `/admin/builders/${b.userId}`)}>{b.handle}</a>
                  </td>
                  <td>{b.name}</td>
                  <td>{b.email}</td>
                  <td>{countryName(p.locale, b.country)}</td>
                  <td>{b.createdAt.slice(0, 10)}</td>
                  <td>{tr(b.inviteCodeHash ? "admin.yes" : "admin.no")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
};
