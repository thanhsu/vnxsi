import type { FC } from "hono/jsx";
import { canPostMessage, DECLINE_REASON_MAX, REPLY_MAX, type InquiryMessage, type InquirySummary } from "../domain/inquiry.ts";
import { localizedPath, type Locale } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import { BUDGET_KEY, INQUIRY_STATUS_KEY, INQUIRY_TYPE_KEY } from "./labels.ts";
import { PlainText } from "./PlainText.tsx";

type Props = {
  locale: Locale;
  summary: InquirySummary;
  messages: InquiryMessage[];
  viewer: "builder" | "client";
  /** Locale-prefixed path of this thread page; actions post to `${base}/reply` etc. */
  base: string;
  replyError?: string;
  reasonError?: string;
  values?: { body?: string; reason?: string };
};

const when = (iso: string) => `${iso.slice(0, 16).replace("T", " ")} UTC`;

export const InquiryThread: FC<Props> = ({ locale, summary, messages, viewer, base, replyError, reasonError, values }) => {
  const tr = translator(locale);
  const inquiry = summary.inquiry;
  const nameOf = (m: InquiryMessage) => {
    const fromClient = m.senderUserId === inquiry.clientUserId;
    if ((viewer === "client") === fromClient) return tr("thread.you");
    return fromClient ? inquiry.clientName : summary.builderName;
  };
  const active = canPostMessage(inquiry.status);
  return (
    <article class="thread">
      <dl class="facts">
        <dt>{tr("thread.type")}</dt>
        <dd>{tr(INQUIRY_TYPE_KEY[inquiry.type])}</dd>
        <dt>{tr("inbox.about")}</dt>
        <dd>
          {summary.productSlug && summary.productName ? <a href={localizedPath(locale, `/p/${summary.productSlug}`)}>{summary.productName}</a> : <a href={localizedPath(locale, `/b/${summary.builderHandle}`)}>{summary.builderName}</a>}
        </dd>
        <dt>{tr("thread.budget")}</dt>
        <dd>{tr(BUDGET_KEY[inquiry.budgetBand])}</dd>
        {inquiry.deadline ? (
          <>
            <dt>{tr("thread.deadline")}</dt>
            <dd>{inquiry.deadline}</dd>
          </>
        ) : null}
        <dt>{tr("hub.status.label")}</dt>
        <dd>
          <span class={`badge badge-inquiry-${inquiry.status}`}>{tr(INQUIRY_STATUS_KEY[inquiry.status])}</span>
        </dd>
      </dl>

      <ol class="messages">
        {messages.map((m) => (
          <li class={m.senderUserId === inquiry.clientUserId ? "from-client" : "from-builder"}>
            <p class="muted">
              <strong>{nameOf(m)}</strong> · {when(m.createdAt)}
            </p>
            {m.kind === "decline" ? <p>{tr("thread.declined", { name: summary.builderName })}</p> : null}
            {m.body ? <PlainText text={m.body} /> : null}
          </li>
        ))}
      </ol>

      {active ? (
        <>
          <form method="post" action={`${base}/reply`} class="card wide">
            <div class="field">
              <label for="th-body">{tr("thread.reply")}</label>
              <textarea id="th-body" name="body" required maxlength={REPLY_MAX} aria-invalid={replyError ? "true" : undefined} aria-describedby={replyError ? "th-body-error" : undefined}>
                {values?.body ?? ""}
              </textarea>
              <p class="hint">{tr("thread.replyHint")}</p>
              {replyError ? (
                <p id="th-body-error" class="error-msg" role="alert">
                  {replyError}
                </p>
              ) : null}
            </div>
            <button class="btn" type="submit">
              {tr("thread.send")}
            </button>
          </form>
          <div class="row-actions">
            {viewer === "builder" && inquiry.status === "open" ? (
              <form method="post" action={`${base}/decline`} class="card wide">
                <div class="field">
                  <label for="th-reason">{tr("thread.declineReason")}</label>
                  <textarea id="th-reason" name="reason" maxlength={DECLINE_REASON_MAX} aria-invalid={reasonError ? "true" : undefined}>
                    {values?.reason ?? ""}
                  </textarea>
                  {reasonError ? (
                    <p class="error-msg" role="alert">
                      {reasonError}
                    </p>
                  ) : null}
                </div>
                <button class="btn btn-secondary" type="submit">
                  {tr("thread.decline")}
                </button>
              </form>
            ) : null}
            <form method="post" action={`${base}/close`}>
              <button class="link" type="submit">
                {tr("thread.close")}
              </button>
            </form>
          </div>
        </>
      ) : (
        <p class="notice">{tr("thread.closed")}</p>
      )}
    </article>
  );
};
