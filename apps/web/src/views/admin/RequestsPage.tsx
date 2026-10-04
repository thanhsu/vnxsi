import type { FC } from "hono/jsx";
import { REQUEST_STATUSES, type AdminRequest, type RequestStatus } from "../../domain/request.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { CATEGORY_KEY, REQUEST_STATUS_KEY } from "../labels.ts";
import { AdminLayout } from "./AdminLayout.tsx";

/** Admin only: names the client with the typed name and the e-mail (spec §5.5). Never reuse for a builder. */
export const AdminRequestsPage: FC<{ locale: Locale; origin: string; status: RequestStatus | null; items: AdminRequest[] }> = (p) => {
  const tr = translator(p.locale);
  const base = localizedPath(p.locale, "/admin/requests");
  return (
    <AdminLayout locale={p.locale} origin={p.origin} title={tr("admin.nav.requests")} rest="/admin/requests" active="requests">
      <h1>{tr("admin.nav.requests")}</h1>
      <nav class="subnav" aria-label={tr("admin.inquiries.filter")}>
        <a href={`${base}?status=all`} aria-current={p.status === null ? "page" : undefined}>
          {tr("filter.any")}
        </a>
        {REQUEST_STATUSES.map((s) => (
          <a href={`${base}?status=${s}`} aria-current={p.status === s ? "page" : undefined}>
            {tr(REQUEST_STATUS_KEY[s])}
          </a>
        ))}
      </nav>
      {p.items.length === 0 ? (
        <p class="muted">{tr("me.requests.empty")}</p>
      ) : (
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>{tr("admin.requests.title")}</th>
                <th>{tr("admin.inquiries.client")}</th>
                <th>{tr("request.facts.category")}</th>
                <th>{tr("hub.status.label")}</th>
                <th>{tr("admin.requests.invites")}</th>
                <th>{tr("admin.requests.proposals")}</th>
              </tr>
            </thead>
            <tbody>
              {p.items.map(({ request: r, clientEmail, activeInvites, totalInvites, proposals }) => (
                <tr>
                  <td>
                    <a href={localizedPath(p.locale, `/admin/requests/${r.id}`)}>{r.title}</a>
                    <br />
                    <span class="muted">{(r.submittedAt ?? r.createdAt).slice(0, 10)}</span>
                  </td>
                  <td>
                    {r.clientName}
                    <br />
                    <span class="muted">{clientEmail}</span>
                  </td>
                  <td>{tr(CATEGORY_KEY[r.category])}</td>
                  <td>{tr(REQUEST_STATUS_KEY[r.status])}</td>
                  <td>{tr("admin.requests.count", { active: activeInvites, total: totalInvites })}</td>
                  <td>{proposals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
};
