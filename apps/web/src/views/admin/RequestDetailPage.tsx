import type { FC } from "hono/jsx";
import { MAX_ACTIVE_INVITES, requestTransition, type AdminRequest, type InviteWithBuilder, type Suggestion, type SuggestionReason } from "../../domain/request.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator, type Translate } from "../../i18n/t.ts";
import { INVITE_STATUS_KEY, REQUEST_STATUS_KEY } from "../labels.ts";
import { PlainText } from "../PlainText.tsx";
import { proposalPrice } from "../proposal.ts";
import { RequestFacts } from "../RequestFacts.tsx";
import { AdminLayout } from "./AdminLayout.tsx";

export type InviteError = "none" | "too_many" | "handle";

type Props = {
  locale: Locale;
  origin: string;
  item: AdminRequest;
  invites: InviteWithBuilder[];
  /** null when the request cannot take more invitations (status or full). */
  suggestions: Suggestion[] | null;
  notice: "done" | "mail_failed" | null;
  inviteError?: InviteError;
  noteError?: boolean;
  values?: { note?: string; handle?: string };
};

const INVITE_ERROR_KEY: Record<InviteError, MessageKey> = {
  none: "admin.requests.error.none",
  too_many: "admin.requests.error.too_many",
  handle: "admin.requests.error.handle",
};

function reasonText(tr: Translate, r: SuggestionReason): string {
  switch (r.kind) {
    case "category":
      return tr("admin.requests.reason.category");
    case "skill":
      return tr("admin.requests.reason.skill", { skill: r.skill });
    case "language":
      return tr("admin.requests.reason.language");
    case "open":
      return tr("admin.requests.reason.open");
    case "expired":
      return tr("admin.requests.reason.expired", { n: r.count });
  }
}

/**
 * Spec §5.5 / §8.10: the admin reads the request, sees suggestions with reasons, invites, returns or removes.
 * Admin only: the client appears with the typed name and the e-mail, so RequestFacts is used without `showClient`
 * (that flag masks e-mail-like names for builders). Never reuse this page's client line for a builder.
 */
export const RequestDetailPage: FC<Props> = (p) => {
  const tr = translator(p.locale);
  const r = p.item.request;
  const base = localizedPath(p.locale, `/admin/requests/${r.id}`);
  const free = MAX_ACTIVE_INVITES - p.item.activeInvites;
  const invitable = requestTransition(r.status, "invite", "admin").ok;
  return (
    <AdminLayout locale={p.locale} origin={p.origin} title={r.title} rest={`/admin/requests/${r.id}`} active="requests">
      <p>
        <a href={localizedPath(p.locale, "/admin/requests")}>{tr("admin.nav.requests")}</a>
      </p>
      <h1>{r.title}</h1>
      {p.notice === "done" ? (
        <p class="notice good" role="status">
          {tr("admin.done")}
        </p>
      ) : null}
      {p.notice === "mail_failed" ? (
        <p class="notice" role="alert">
          {tr("admin.requests.mailFailed")}
        </p>
      ) : null}
      <p>
        <span class={`badge badge-request-${r.status}`}>{tr(REQUEST_STATUS_KEY[r.status])}</span> · {r.clientName} · <span class="muted">{p.item.clientEmail}</span>
      </p>
      {r.adminNote ? (
        <div class="notice">
          <PlainText text={r.adminNote} />
        </div>
      ) : null}
      <section class="card wide">
        <RequestFacts locale={p.locale} request={r} />
      </section>

      <section>
        <h2>{tr("admin.requests.invites")}</h2>
        <p class="muted">{tr("admin.requests.count", { active: p.item.activeInvites, total: p.item.totalInvites })}</p>
        {p.invites.length > 0 ? (
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>{tr("admin.inquiries.builder")}</th>
                  <th>{tr("hub.status.label")}</th>
                  <th>{tr("admin.requests.proposals")}</th>
                  <th>{tr("admin.requests.invitedAt")}</th>
                </tr>
              </thead>
              <tbody>
                {p.invites.map(({ invite, builderName, builderHandle, builderPublic }) => (
                  <tr>
                    <td>
                      {builderPublic ? <a href={localizedPath(p.locale, `/b/${builderHandle}`)}>{builderName}</a> : builderName} <span class="muted">@{builderHandle}</span>
                    </td>
                    <td>{tr(INVITE_STATUS_KEY[invite.status])}</td>
                    <td>
                      {invite.approach !== null ? (
                        <>
                          {proposalPrice(p.locale, invite)} · {tr("proposal.days", { n: invite.timelineDays ?? 0 })}
                        </>
                      ) : null}
                      {invite.declineReason ? <PlainText text={invite.declineReason} /> : null}
                    </td>
                    <td class="muted">{invite.invitedAt.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {p.suggestions !== null ? (
        <section class="card wide">
          <h2>{tr("admin.requests.suggestions")}</h2>
          <p class="hint">{tr("admin.requests.suggestionsHint")}</p>
          <p>{tr("admin.requests.slots", { n: free })}</p>
          {p.inviteError ? (
            <p class="error-msg" role="alert">
              {tr(INVITE_ERROR_KEY[p.inviteError])}
            </p>
          ) : null}
          <form method="post" action={`${base}/invite`}>
            {p.suggestions.length === 0 ? (
              <p class="muted">{tr("admin.requests.noCandidates")}</p>
            ) : (
              <div class="table-wrap">
                <table class="data">
                  <thead>
                    <tr>
                      <th></th>
                      <th>{tr("admin.inquiries.builder")}</th>
                      <th>{tr("admin.requests.score")}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.suggestions.map((s) => (
                      <tr>
                        <td>
                          <input type="checkbox" id={`sg-${s.candidate.userId}`} name="builder" value={s.candidate.userId} />
                        </td>
                        <td>
                          <label for={`sg-${s.candidate.userId}`}>{s.candidate.name}</label> <a href={localizedPath(p.locale, `/b/${s.candidate.handle}`)}>@{s.candidate.handle}</a>
                        </td>
                        <td>{s.score}</td>
                        <td class="muted">{s.reasons.map((reason) => reasonText(tr, reason)).join(" · ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div class="field">
              <label for="ar-handle">{tr("admin.requests.handle")}</label>
              <input id="ar-handle" name="handle" value={p.values?.handle ?? ""} />
            </div>
            <button class="btn" type="submit">
              {tr("admin.requests.invite")}
            </button>
          </form>
        </section>
      ) : invitable ? (
        <p class="notice">{tr("admin.requests.full")}</p>
      ) : null}

      {r.status === "submitted" ? (
        <form method="post" action={`${base}/reject`} class="card wide">
          <div class="field">
            <label for="ar-note">{tr("admin.requests.note")}</label>
            <textarea id="ar-note" name="note" required maxlength={1000} aria-invalid={p.noteError ? "true" : undefined}>
              {p.values?.note ?? ""}
            </textarea>
            {p.noteError ? (
              <p class="error-msg" role="alert">
                {tr("admin.requests.error.note")}
              </p>
            ) : null}
          </div>
          <button class="btn btn-secondary" type="submit">
            {tr("admin.requests.reject")}
          </button>
        </form>
      ) : null}
      {r.status !== "removed" ? (
        <form method="post" action={`${base}/remove`}>
          <button class="link" type="submit">
            {tr("admin.requests.remove")}
          </button>
        </form>
      ) : null}
    </AdminLayout>
  );
};
