import type { FC } from "hono/jsx";
import { INQUIRY_STATUSES, type AdminInquiry, type InquiryStatus } from "../../domain/inquiry.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { INQUIRY_STATUS_KEY, INQUIRY_TYPE_KEY } from "../labels.ts";
import { AdminLayout } from "./AdminLayout.tsx";

export const AdminInquiriesPage: FC<{ locale: Locale; origin: string; status: InquiryStatus | null; items: AdminInquiry[] }> = (p) => {
  const tr = translator(p.locale);
  const base = localizedPath(p.locale, "/admin/inquiries");
  return (
    <AdminLayout locale={p.locale} origin={p.origin} title={tr("admin.nav.inquiries")} rest="/admin/inquiries" active="inquiries">
      <h1>{tr("admin.nav.inquiries")}</h1>
      <nav class="subnav" aria-label={tr("admin.inquiries.filter")}>
        <a href={base} aria-current={p.status === null ? "page" : undefined}>
          {tr("filter.any")}
        </a>
        {INQUIRY_STATUSES.map((s) => (
          <a href={`${base}?status=${s}`} aria-current={p.status === s ? "page" : undefined}>
            {tr(INQUIRY_STATUS_KEY[s])}
          </a>
        ))}
      </nav>
      {p.items.length === 0 ? (
        <p class="muted">{tr("inbox.empty")}</p>
      ) : (
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>ID</th>
                <th>{tr("admin.inquiries.client")}</th>
                <th>{tr("admin.inquiries.builder")}</th>
                <th>{tr("admin.inquiries.message")}</th>
                <th>{tr("hub.status.label")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {p.items.map(({ inquiry, clientEmail, builderHandle, productName }) => (
                <tr>
                  <td>
                    <code>{inquiry.id}</code>
                    <br />
                    <span class="muted">{inquiry.createdAt.slice(0, 10)}</span>
                  </td>
                  <td>
                    {inquiry.clientName}
                    <br />
                    <span class="muted">{clientEmail}</span>
                  </td>
                  <td>
                    @{builderHandle}
                    {productName ? ` · ${productName}` : null}
                    <br />
                    <span class="muted">{tr(INQUIRY_TYPE_KEY[inquiry.type])}</span>
                  </td>
                  <td>{inquiry.message.length > 200 ? `${inquiry.message.slice(0, 200)}…` : inquiry.message}</td>
                  <td>{tr(INQUIRY_STATUS_KEY[inquiry.status])}</td>
                  <td>
                    {inquiry.status !== "removed" ? (
                      <form method="post" action={localizedPath(p.locale, `/admin/inquiries/${inquiry.id}/remove`)}>
                        <button class="link" type="submit">
                          {tr("admin.inquiries.remove")}
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
};
