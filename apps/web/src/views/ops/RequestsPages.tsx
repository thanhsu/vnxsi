import type { FC } from "hono/jsx";
import { MAX_ACTIVE_INVITES, REQUEST_STATUSES, requestTransition, type AdminRequest, type InviteWithBuilder, type RequestStatus, type Suggestion, type SuggestionReason } from "../../domain/request.ts";
import type { MessageKey, OpsMessageKey } from "../../i18n/messages/en.ts";
import type { InviteError } from "../admin/RequestDetailPage.tsx";
import { BUDGET_KEY, CATEGORY_KEY, INVITE_STATUS_KEY, LANGUAGE_KEY } from "../labels.ts";
import { PlainText } from "../PlainText.tsx";
import { proposalPrice } from "../proposal.ts";
import { BUILDERS_PATH } from "./BuildersPages.tsx";
import { OpsLayout, type OpsShell } from "./OpsLayout.tsx";
import { Confirm, History, Notice, Pill, qs, ReasonField, SearchForm, Tabs, tr, utc, type HistoryView, type OpsNotice, type PillTone } from "./parts.tsx";

/**
 * /ops/marketplace/requests and its detail page (VNX-2504b; spec §7.3; mockup OpsBuilders, same list and detail layout
 * as Builders). The detail shows what /admin/requests showed, the client's e-mail included (Ops only, spec §3.1; never
 * reuse for a builder). Forms and checkboxes only when `canAct`.
 */

export const REQUESTS_PATH = "/ops/marketplace/requests";

/** The list filter, from the URL (allowlisted by the route): a status or "all", and a search. */
export type RequestFilter = { status?: RequestStatus | "all"; q?: string };

const TONE: Record<RequestStatus, PillTone> = {
  pending_verification: "mute",
  submitted: "pending",
  matching: "info",
  builder_selected: "ok",
  rejected: "bad",
  expired: "mute",
  closed: "mute",
  removed: "bad",
};
/** The states by their own names (the labels in labels.ts are worded for the client). */
const STATUS_KEY: Record<RequestStatus, OpsMessageKey> = {
  pending_verification: "ops.requests.status.pending_verification",
  submitted: "ops.requests.status.submitted",
  matching: "ops.requests.status.matching",
  builder_selected: "ops.requests.status.builder_selected",
  rejected: "ops.requests.status.rejected",
  expired: "ops.requests.status.expired",
  closed: "ops.requests.status.closed",
  removed: "ops.requests.status.removed",
};
const StatusPill: FC<{ status: RequestStatus }> = ({ status }) => <Pill tone={TONE[status]} label={tr(STATUS_KEY[status])} />;
const invitesLine = (item: AdminRequest) => tr("admin.requests.count", { active: item.activeInvites, total: item.totalInvites });

type ListProps = {
  shell: OpsShell;
  /** The open tab: a status, or null for "All". */
  status: RequestStatus | null;
  q: string | null;
  counts: Partial<Record<RequestStatus, number>>;
  items: AdminRequest[];
  notice: OpsNotice;
};

export const RequestsListPage: FC<ListProps> = ({ shell, status, q, counts, items, notice }) => {
  const tab = status ?? "all";
  const all = Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0);
  const total = status ? (counts[status] ?? 0) : all;
  const tabs = [
    ...REQUEST_STATUSES.map((s) => ({ href: REQUESTS_PATH + qs({ status: s, q }), label: tr(STATUS_KEY[s]), count: counts[s] ?? 0, current: s === status })),
    { href: REQUESTS_PATH + qs({ status: "all", q }), label: tr("ops.requests.all"), count: all, current: status === null },
  ];
  return (
    <OpsLayout {...shell} page={tr("ops.nav.requests")} trail={[tr("ops.group.marketplace")]}>
      <div class="ops-ph">
        <h1>{tr("ops.nav.requests")}</h1>
        <p>{tr("ops.requests.lead")}</p>
      </div>
      <Notice notice={notice} />
      <section class="ops-card ops-queue-list" aria-label={tr("ops.requests.queue")}>
        <Tabs tabs={tabs} />
        <SearchForm action={REQUESTS_PATH} q={q} keep={{ status: tab }} label={tr("ops.requests.search")} placeholder={tr("ops.requests.searchHint")} />
        {items.length === 0 ? (
          <p class="ops-state">{tr(q ? "ops.requests.noMatch" : "ops.requests.empty")}</p>
        ) : (
          <>
            <div class="ops-table-wrap">
              <table class="ops-table">
                <thead>
                  <tr>
                    <th scope="col">{tr("ops.requests.col.request")}</th>
                    <th scope="col">{tr("ops.list.status")}</th>
                    <th scope="col">{tr("ops.requests.col.client")}</th>
                    <th scope="col">{tr("request.facts.category")}</th>
                    <th scope="col">{tr("admin.requests.invites")}</th>
                    <th scope="col">{tr("admin.requests.proposals")}</th>
                    <th scope="col">{tr("ops.requests.col.submitted")}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr>
                      <td>
                        <a class="ops-strong" href={`${REQUESTS_PATH}/${item.request.id}${qs({ status: tab, q })}`}>
                          {item.request.title}
                        </a>
                      </td>
                      <td>
                        <StatusPill status={item.request.status} />
                      </td>
                      <td>
                        {item.request.clientName}
                        <br />
                        <span class="ops-muted ops-break">{item.clientEmail}</span>
                      </td>
                      <td>{tr(CATEGORY_KEY[item.request.category])}</td>
                      <td class="ops-nowrap">{invitesLine(item)}</td>
                      <td class="ops-mono">{item.proposals}</td>
                      <td class="ops-mono">{(item.request.submittedAt ?? item.request.createdAt).slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p class="ops-table-foot">{q ? tr("ops.list.shown", { n: items.length }) : tr("ops.list.count", { n: items.length, total })}</p>
          </>
        )}
      </section>
    </OpsLayout>
  );
};

const INVITE_ERROR_KEY: Record<InviteError, MessageKey> = {
  none: "admin.requests.error.none",
  too_many: "admin.requests.error.too_many",
  handle: "admin.requests.error.handle",
};

function reasonText(r: SuggestionReason): string {
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

type DetailProps = {
  shell: OpsShell;
  item: AdminRequest;
  invites: InviteWithBuilder[];
  /** null when the request cannot take more invitations (status or full). */
  suggestions: Suggestion[] | null;
  filter: RequestFilter;
  canAct: boolean;
  notice: OpsNotice;
  inviteError?: InviteError;
  noteError?: boolean;
  values?: { note?: string; handle?: string };
  history: HistoryView;
};

/** The suggestions with their reasons; with `canAct` a checkbox per builder, inside the invite form. */
const Suggestions: FC<{ suggestions: Suggestion[]; canAct: boolean }> = ({ suggestions, canAct }) =>
  suggestions.length === 0 ? (
    <p class="ops-muted">{tr("admin.requests.noCandidates")}</p>
  ) : (
    <div class="ops-table-wrap">
      <table class="ops-table">
        <thead>
          <tr>
            {canAct ? (
              <th scope="col">
                <span class="visually-hidden">{tr("ops.requests.col.choose")}</span>
              </th>
            ) : null}
            <th scope="col">{tr("admin.inquiries.builder")}</th>
            <th scope="col">{tr("admin.requests.score")}</th>
            <th scope="col">{tr("ops.requests.col.why")}</th>
          </tr>
        </thead>
        <tbody>
          {suggestions.map(({ candidate: b, score, reasons }) => (
            <tr>
              {canAct ? (
                <td>
                  <input type="checkbox" id={`sg-${b.userId}`} name="builder" value={b.userId} class="ops-check" />
                </td>
              ) : null}
              <td>
                {canAct ? <label for={`sg-${b.userId}`}>{b.name}</label> : b.name} <a href={`${BUILDERS_PATH}/${b.userId}`}>@{b.handle}</a>
              </td>
              <td class="ops-mono">{score}</td>
              <td class="ops-muted">{reasons.map(reasonText).join(" · ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

export const RequestDetailPage: FC<DetailProps> = (props) => {
  const { shell, item, invites, suggestions, filter, canAct, notice, inviteError, noteError, values, history } = props;
  const r = item.request;
  const action = (name: string) => `${REQUESTS_PATH}/${r.id}/${name}${qs(filter)}`;
  const invitable = requestTransition(r.status, "invite", "admin").ok;
  const canReject = r.status === "submitted";
  const canRemove = r.status !== "removed";
  return (
    <OpsLayout {...shell} page={r.title} trail={[tr("ops.group.marketplace"), tr("ops.nav.requests")]}>
      <a class="ops-back" href={REQUESTS_PATH + qs(filter)}>
        <span aria-hidden="true">←</span>
        {tr("ops.nav.requests")}
      </a>
      <div class="ops-ph ops-ph-row">
        <h1>{r.title}</h1>
        <StatusPill status={r.status} />
      </div>
      <Notice notice={notice} />
      <div class="ops-split">
        <div class="ops-stack">
          <section class="ops-card ops-sec" aria-labelledby="ops-request-h">
            <h2 id="ops-request-h">{tr("ops.requests.col.request")}</h2>
            <dl class="ops-dl">
              <dt>{tr("ops.requests.col.client")}</dt>
              <dd>{r.clientName}</dd>
              <dt>{tr("ops.requests.field.clientEmail")}</dt>
              <dd class="ops-break">{item.clientEmail}</dd>
              <dt>{tr("request.facts.category")}</dt>
              <dd>{tr(CATEGORY_KEY[r.category])}</dd>
              <dt>{tr("thread.budget")}</dt>
              <dd>{tr(BUDGET_KEY[r.budgetBand])}</dd>
              {r.deadline ? (
                <>
                  <dt>{tr("thread.deadline")}</dt>
                  <dd class="ops-mono">{r.deadline}</dd>
                </>
              ) : null}
              <dt>{tr("request.facts.languages")}</dt>
              <dd>{r.languages.map((l) => tr(LANGUAGE_KEY[l])).join(", ") || "—"}</dd>
              <dt>{tr("ops.requests.col.submitted")}</dt>
              <dd class="ops-mono">{r.submittedAt ? utc(r.submittedAt) : "—"}</dd>
              <dt>{tr("ops.requests.field.created")}</dt>
              <dd class="ops-mono">{utc(r.createdAt)}</dd>
              <dt>{tr("ops.requests.field.updated")}</dt>
              <dd class="ops-mono">{utc(r.updatedAt)}</dd>
            </dl>
            <h3>{tr("ops.requests.description")}</h3>
            <PlainText text={r.description} />
            {r.adminNote ? (
              <>
                <h3>{tr("ops.requests.adminNote")}</h3>
                <PlainText text={r.adminNote} />
              </>
            ) : null}
          </section>
          <section class="ops-card ops-sec" aria-labelledby="ops-invites-h">
            <h2 id="ops-invites-h">{tr("admin.requests.invites")}</h2>
            <p class="ops-muted">{invitesLine(item)}</p>
            {invites.length === 0 ? (
              <p class="ops-muted">{tr("ops.requests.noInvites")}</p>
            ) : (
              <div class="ops-table-wrap">
                <table class="ops-table">
                  <thead>
                    <tr>
                      <th scope="col">{tr("admin.inquiries.builder")}</th>
                      <th scope="col">{tr("ops.list.status")}</th>
                      <th scope="col">{tr("admin.requests.proposals")}</th>
                      <th scope="col">{tr("admin.requests.invitedAt")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invites.map(({ invite, builderName, builderHandle }) => (
                      <tr>
                        <td>
                          <a class="ops-strong" href={`${BUILDERS_PATH}/${invite.builderId}`}>
                            {builderName}
                          </a>{" "}
                          <span class="ops-muted ops-mono">@{builderHandle}</span>
                        </td>
                        <td>{tr(INVITE_STATUS_KEY[invite.status])}</td>
                        <td>
                          {invite.approach !== null ? `${proposalPrice("en", invite)} · ${tr("proposal.days", { n: invite.timelineDays ?? 0 })}` : null}
                          {invite.declineReason ? <PlainText text={invite.declineReason} /> : null}
                        </td>
                        <td class="ops-mono">{invite.invitedAt.slice(0, 10)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          {suggestions !== null ? (
            <section class="ops-card ops-sec ops-invite-sec" aria-labelledby="ops-suggestions-h">
              <h2 id="ops-suggestions-h">{tr("admin.requests.suggestions")}</h2>
              <p class="ops-note">{tr("admin.requests.suggestionsHint")}</p>
              <p class="ops-p">{tr("admin.requests.slots", { n: MAX_ACTIVE_INVITES - item.activeInvites })}</p>
              {canAct ? (
                <form method="post" action={action("invite")}>
                  {inviteError ? (
                    <p id="invite-error" class="ops-field-error" role="alert">
                      {tr(INVITE_ERROR_KEY[inviteError])}
                    </p>
                  ) : null}
                  <Suggestions suggestions={suggestions} canAct />
                  <div class="ops-field">
                    <label for="invite-handle">{tr("admin.requests.handle")}</label>
                    <input
                      class="ops-in"
                      id="invite-handle"
                      name="handle"
                      value={values?.handle ?? ""}
                      maxlength={40}
                      aria-invalid={inviteError === "handle" ? "true" : undefined}
                      aria-describedby={inviteError ? "invite-error" : undefined}
                    />
                  </div>
                  <p class="ops-note">{tr("ops.requests.inviteHelp")}</p>
                  <button class="ops-btn ops-btn-primary" type="submit">
                    {tr("admin.requests.invite")}
                  </button>
                </form>
              ) : (
                <Suggestions suggestions={suggestions} canAct={false} />
              )}
            </section>
          ) : null}
        </div>
        <div class="ops-stack">
          <section class="ops-card ops-sec" aria-labelledby="ops-decision-h">
            <h2 id="ops-decision-h">{tr("ops.detail.decision")}</h2>
            {invitable && suggestions === null ? <p class="ops-p">{tr("admin.requests.full")}</p> : null}
            {!canAct ? (
              <p class="ops-muted">{tr("ops.detail.viewOnly")}</p>
            ) : canReject || canRemove ? (
              <div class="ops-actions">
                {canReject ? (
                  <Confirm summary={tr("ops.requests.rejectOpen")} open={noteError}>
                    <form method="post" action={action("reject")}>
                      <ReasonField id="reject-note" name="note" label={tr("admin.requests.note")} max={1000} required error={noteError ? tr("admin.requests.error.note") : null} value={values?.note} />
                      <p class="ops-note">{tr("ops.requests.rejectHelp", { name: r.clientName })}</p>
                      <button class="ops-btn ops-btn-danger" type="submit">
                        {tr("ops.requests.rejectConfirm")}
                      </button>
                    </form>
                  </Confirm>
                ) : null}
                {canRemove ? (
                  <Confirm summary={tr("ops.requests.removeOpen")}>
                    <form method="post" action={action("remove")}>
                      <p class="ops-note">{tr("ops.requests.removeHelp")}</p>
                      <button class="ops-btn ops-btn-danger" type="submit">
                        {tr("ops.requests.removeConfirm")}
                      </button>
                    </form>
                  </Confirm>
                ) : null}
              </div>
            ) : (
              <p class="ops-muted">{tr("ops.detail.noAction")}</p>
            )}
          </section>
          <History history={history} empty={tr("ops.requests.noHistory")} />
        </div>
      </div>
    </OpsLayout>
  );
};
