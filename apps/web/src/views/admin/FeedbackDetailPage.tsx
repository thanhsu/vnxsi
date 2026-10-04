import type { FC } from "hono/jsx";
import { FEEDBACK_ACTIONS, feedbackTransition, type Feedback, type FeedbackAction } from "../../domain/feedback.ts";
import { isLocale, localizedPath, type Locale } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { t, translator } from "../../i18n/t.ts";
import { FEEDBACK_KIND_KEY, FEEDBACK_ROLE_KEY } from "../contact/ContactForm.tsx";
import { PlainText } from "../PlainText.tsx";
import { AdminLayout } from "./AdminLayout.tsx";
import { FEEDBACK_STATUS_KEY, when } from "./FeedbackPage.tsx";

const ACTION_KEY: Record<FeedbackAction, MessageKey> = {
  handle: "admin.feedback.handle",
  spam: "admin.feedback.spam",
  reopen: "admin.feedback.reopen",
};

/** mailto: link with "Re: <kind> · VNX.SI" in the sender's language. */
function replyHref(item: Feedback): string {
  const senderLocale: Locale = isLocale(item.locale) ? item.locale : "en";
  const subject = `Re: ${t(senderLocale, FEEDBACK_KIND_KEY[item.kind])} · VNX.SI`;
  return `mailto:${encodeURIComponent(item.email).replace(/%40/g, "@")}?subject=${encodeURIComponent(subject)}`;
}

/** /admin/feedback/:id (plan VNX-0710): the whole message as plain text, the facts, a reply link and the status buttons. */
export const FeedbackDetailPage: FC<{ locale: Locale; origin: string; item: Feedback; newCount: number }> = ({ locale, origin, item, newCount }) => {
  const tr = translator(locale);
  const actions = FEEDBACK_ACTIONS.filter((a) => feedbackTransition(item.status, a).ok);
  return (
    <AdminLayout locale={locale} origin={origin} title={tr("admin.nav.feedback")} rest={`/admin/feedback/${item.id}`} active="feedback" feedbackNew={newCount}>
      <p>
        <a href={`${localizedPath(locale, "/admin/feedback")}?status=${item.status}`}>{tr("admin.feedback.back")}</a>
      </p>
      <h1>{tr(FEEDBACK_KIND_KEY[item.kind])}</h1>
      <dl class="facts">
        <dt>{tr("admin.feedback.col.status")}</dt>
        <dd>
          {tr(FEEDBACK_STATUS_KEY[item.status])}
          {item.notifiedAt === null ? (
            <>
              {" "}
              <span class="badge badge-warning">{tr("admin.feedback.notSent")}</span>
            </>
          ) : null}
        </dd>
        <dt>{tr("admin.feedback.col.time")}</dt>
        <dd>{when(item.createdAt)}</dd>
        <dt>{tr("admin.feedback.col.role")}</dt>
        <dd>{tr(FEEDBACK_ROLE_KEY[item.role])}</dd>
        <dt>{tr("admin.col.name")}</dt>
        <dd>{item.name ?? "—"}</dd>
        <dt>{tr("admin.col.email")}</dt>
        <dd class="break">{item.email}</dd>
        <dt>{tr("admin.feedback.col.locale")}</dt>
        <dd>{item.locale}</dd>
        <dt>{tr("admin.col.account")}</dt>
        <dd>{item.userId ? tr("admin.yes") : tr("admin.no")}</dd>
        <dt>ID</dt>
        <dd>
          <code>{item.id}</code>
        </dd>
      </dl>
      <section class="feedback-message" aria-label={tr("admin.feedback.col.message")}>
        <PlainText text={item.message} />
      </section>
      <div class="row-actions">
        <a class="btn btn-primary" href={replyHref(item)}>
          {tr("admin.feedback.reply")}
        </a>
        {actions.map((action) => (
          <form method="post" action={localizedPath(locale, `/admin/feedback/${item.id}/${action}`)}>
            <button class="btn btn-ghost" type="submit">
              {tr(ACTION_KEY[action])}
            </button>
          </form>
        ))}
      </div>
    </AdminLayout>
  );
};
