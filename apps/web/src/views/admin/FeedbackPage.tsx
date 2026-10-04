import type { FC } from "hono/jsx";
import { FEEDBACK_STATUSES, type Feedback, type FeedbackStatus } from "../../domain/feedback.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator } from "../../i18n/t.ts";
import { FEEDBACK_KIND_KEY, FEEDBACK_ROLE_KEY } from "../contact/ContactForm.tsx";
import { AdminLayout } from "./AdminLayout.tsx";

export const FEEDBACK_STATUS_KEY: Record<FeedbackStatus, MessageKey> = {
  new: "admin.feedback.status.new",
  handled: "admin.feedback.status.handled",
  spam: "admin.feedback.status.spam",
};

const EXCERPT = 120;

/** "2026-10-04 08:15 UTC" from an ISO timestamp. */
export const when = (iso: string) => `${iso.slice(0, 16).replace("T", " ")} UTC`;

type Props = { locale: Locale; origin: string; status: FeedbackStatus; page: number; hasNext: boolean; items: Feedback[]; newCount: number };

/** /admin/feedback (plan VNX-0710): contact messages by status, newest first, 50 a page. */
export const FeedbackPage: FC<Props> = (p) => {
  const tr = translator(p.locale);
  const base = localizedPath(p.locale, "/admin/feedback");
  const pageHref = (n: number) => `${base}?status=${p.status}&page=${n}`;
  return (
    <AdminLayout locale={p.locale} origin={p.origin} title={tr("admin.nav.feedback")} rest="/admin/feedback" active="feedback" feedbackNew={p.newCount}>
      <h1>{tr("admin.nav.feedback")}</h1>
      <nav class="subnav" aria-label={tr("admin.feedback.filter")}>
        {FEEDBACK_STATUSES.map((s) => (
          <a href={`${base}?status=${s}`} aria-current={p.status === s ? "page" : undefined}>
            {tr(FEEDBACK_STATUS_KEY[s])}
          </a>
        ))}
      </nav>
      {p.items.length === 0 ? (
        <p class="muted">{tr("admin.feedback.empty")}</p>
      ) : (
        <div class="table-wrap">
          <table class="data feedback-table">
            <thead>
              <tr>
                <th>{tr("admin.feedback.col.time")}</th>
                <th>{tr("admin.feedback.col.role")}</th>
                <th>{tr("contact.form.kind")}</th>
                <th>{tr("admin.col.email")}</th>
                <th>{tr("admin.feedback.col.message")}</th>
              </tr>
            </thead>
            <tbody>
              {p.items.map((item) => (
                <tr data-id={item.id}>
                  <td class="nowrap">{when(item.createdAt)}</td>
                  <td>
                    {tr(FEEDBACK_ROLE_KEY[item.role])}
                    {item.name ? (
                      <>
                        <br />
                        <span class="muted">{item.name}</span>
                      </>
                    ) : null}
                  </td>
                  <td>{tr(FEEDBACK_KIND_KEY[item.kind])}</td>
                  <td class="break">{item.email}</td>
                  <td>
                    <a href={localizedPath(p.locale, `/admin/feedback/${item.id}`)}>{item.message.length > EXCERPT ? `${item.message.slice(0, EXCERPT)}…` : item.message}</a>
                    {item.notifiedAt === null ? (
                      <>
                        <br />
                        <span class="badge badge-warning">{tr("admin.feedback.notSent")}</span>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {p.page > 1 || p.hasNext ? (
        <nav class="pager" aria-label={tr("pager.label")}>
          {p.page > 1 ? (
            <a href={pageHref(p.page - 1)} rel="prev">
              {tr("pager.prev")}
            </a>
          ) : null}
          {p.hasNext ? (
            <a href={pageHref(p.page + 1)} rel="next">
              {tr("pager.next")}
            </a>
          ) : null}
        </nav>
      ) : null}
    </AdminLayout>
  );
};
