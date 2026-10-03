import type { FC } from "hono/jsx";
import type { BuilderAccount, BuilderAction } from "../../domain/builder.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { countryName } from "../country.ts";
import { KIND_KEY, STATUS_KEY } from "../labels.ts";
import { PlainText } from "../PlainText.tsx";
import { AdminLayout } from "./AdminLayout.tsx";

export type AdminNotice = "done" | "mail_failed" | null;

type Props = { locale: Locale; origin: string; builder: BuilderAccount; notice: AdminNotice; reasonError?: BuilderAction };

export const BuilderDetailPage: FC<Props> = ({ locale, origin, builder: b, notice, reasonError }) => {
  const tr = translator(locale);
  const action = (name: BuilderAction) => localizedPath(locale, `/admin/builders/${b.userId}/${name}`);
  return (
    <AdminLayout locale={locale} origin={origin} title={b.name} rest={`/admin/builders/${b.userId}`} active="builders">
      <h1>
        {b.name} <span class={`badge badge-${b.status}`}>{tr(STATUS_KEY[b.status])}</span>
      </h1>
      {notice === "done" ? (
        <p class="notice good" role="status">
          {tr("admin.done")}
        </p>
      ) : null}
      {notice === "mail_failed" ? (
        <p class="notice" role="alert">
          {tr("admin.mailFailed")}
        </p>
      ) : null}

      <dl class="facts">
        <dt>{tr("admin.col.handle")}</dt>
        <dd>{b.handle}</dd>
        <dt>{tr("admin.col.email")}</dt>
        <dd>{b.email}</dd>
        <dt>{tr("builder.field.kind")}</dt>
        <dd>{tr(KIND_KEY[b.kind])}</dd>
        <dt>{tr("builder.field.headline")}</dt>
        <dd>{b.headline}</dd>
        <dt>{tr("admin.col.country")}</dt>
        <dd>{countryName(locale, b.country)}</dd>
        <dt>{tr("builder.field.websiteUrl")}</dt>
        <dd>
          {b.websiteUrl ? (
            <a href={b.websiteUrl} rel="nofollow ugc noopener" target="_blank">
              {b.websiteUrl}
            </a>
          ) : (
            "—"
          )}
        </dd>
        <dt>{tr("builder.field.skills")}</dt>
        <dd>{b.skills.join(", ")}</dd>
        <dt>{tr("admin.col.created")}</dt>
        <dd>{b.createdAt.slice(0, 10)}</dd>
      </dl>

      <h2>{tr("builder.field.bio")}</h2>
      <PlainText text={b.bio} />
      {b.reviewNote ? (
        <>
          <h2>{tr("hub.reviewNote")}</h2>
          <PlainText text={b.reviewNote} />
        </>
      ) : null}

      {b.status === "pending" ? (
        <div class="row-actions">
          <form method="post" action={action("approve")}>
            <button class="btn" type="submit">
              {tr("admin.approve")}
            </button>
          </form>
          <form method="post" action={action("reject")} class="card">
            <div class="field">
              <label for="reject-reason">{tr("admin.reason")}</label>
              <textarea
                id="reject-reason"
                name="reason"
                required
                maxlength={500}
                aria-invalid={reasonError === "reject" ? "true" : undefined}
                aria-describedby={reasonError === "reject" ? "reject-reason-error" : undefined}
              ></textarea>
              {reasonError === "reject" ? (
                <p id="reject-reason-error" class="error-msg">
                  {tr("admin.error.reason")}
                </p>
              ) : null}
            </div>
            <button class="btn" type="submit">
              {tr("admin.reject")}
            </button>
          </form>
        </div>
      ) : null}
    </AdminLayout>
  );
};
