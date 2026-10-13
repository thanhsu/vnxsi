import type { FC } from "hono/jsx";
import type { PublicationStatus } from "../../domain/request-board.ts";
import { MAX_ACTIVE_INVITES, REQUEST_STATUSES, requestTransition, type AdminRequest, type InviteWithBuilder, type RequestStatus, type Suggestion, type SuggestionReason } from "../../domain/request.ts";
import type { MessageKey, OpsMessageKey } from "../../i18n/messages/en.ts";
import type { InviteError } from "../admin/RequestDetailPage.tsx";
import { BUDGET_KEY, CATEGORY_KEY, INVITE_STATUS_KEY, LANGUAGE_KEY } from "../labels.ts";
import { PlainText } from "../PlainText.tsx";
import { proposalPrice } from "../proposal.ts";
import { BUILDERS_PATH } from "./BuildersPages.tsx";
import { OpsLayout, type OpsShell } from "./OpsLayout.tsx";
import { InterestedBuilders, type InterestRowView, type InterestsFormState } from "./InterestedBuilders.tsx";
import { PublicListingBlock, type BoardFormState, type PublicationView } from "./PublicListingBlock.tsx";
import { Confirm, History, Notice, Pill, qs, ReasonField, SearchForm, Tabs, tr, utc, type HistoryView, type OpsNotice, type PillTone } from "./parts.tsx";

/**
 * /ops/marketplace/requests and its detail page (VNX-2504b; spec §7.3; mockup OpsBuilders, same list and detail layout
 * as Builders). The detail shows what /admin/requests showed, the client's e-mail included (Ops only, spec §3.1; never
 * reuse for a builder). Forms and checkboxes only when `canAct`.
 */

export const REQUESTS_PATH = "/ops/marketplace/requests";

/** The list filter, from the URL (allowlisted by the route): a status or "all", and a search. */
export type RequestFilter = { status?: RequestStatus | "all"; public?: "pending"; interests?: "pending"; q?: string };

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
/** The "Public" column: the request's listing by its own state names. */
const PUBLIC_KEY: Record<PublicationStatus, OpsMessageKey> = {
  pending_review: "ops.requests.public.pending_review",
  published: "ops.requests.public.published",
  rejected: "ops.requests.public.rejected",
  withdrawn: "ops.requests.public.withdrawn",
  unpublished: "ops.requests.public.unpublished",
};
const PUBLIC_TONE: Record<PublicationStatus, PillTone> = { pending_review: "pending", published: "ok", rejected: "bad", withdrawn: "mute", unpublished: "bad" };
const PublicPill: FC<{ status: PublicationStatus }> = ({ status }) => <Pill tone={PUBLIC_TONE[status]} label={tr(PUBLIC_KEY[status])} />;
const invitesLine = (item: AdminRequest) => tr("admin.requests.count", { active: item.activeInvites, total: item.totalInvites });

type ListProps = {
  shell: OpsShell;
  /** The open tab: a status, or null for "All" (and for the review-queue filter, which has no tab). */
  status: RequestStatus | null;
  /** `?public=pending`: the list is the review queue of public listings. */
  publicPending: boolean;
  /** `?interests=pending`: the list is the requests that have an interest waiting for Ops. */
  interestsPending?: boolean;
  q: string | null;
  counts: Partial<Record<RequestStatus, number>>;
  items: AdminRequest[];
  /** The "Public" column: the listing of each listed request, by request id (no entry: no listing). */
  publications: ReadonlyMap<string, { status: PublicationStatus }>;
  notice: OpsNotice;
};

export const RequestsListPage: FC<ListProps> = ({ shell, status, publicPending, interestsPending, q, counts, items, publications, notice }) => {
  const tab = status ?? "all";
  /** What the list's links carry to the request page and back: the tab, or the review-queue filter, and the search. */
  const carried = publicPending ? { public: "pending", q } : interestsPending ? { interests: "pending", q } : { status: tab, q };
  const all = Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0);
  const total = status ? (counts[status] ?? 0) : all;
  const tabs = [
    ...REQUEST_STATUSES.map((s) => ({ href: REQUESTS_PATH + qs({ status: s, q }), label: tr(STATUS_KEY[s]), count: counts[s] ?? 0, current: s === status })),
    { href: REQUESTS_PATH + qs({ status: "all", q }), label: tr("ops.requests.all"), count: all, current: status === null && !publicPending && !interestsPending },
  ];
  return (
    <OpsLayout {...shell} page={tr("ops.nav.requests")} trail={[tr("ops.group.marketplace")]}>
      <div class="ops-ph">
        <h1>{tr("ops.nav.requests")}</h1>
        <p>{tr("ops.requests.lead")}</p>
      </div>
      <Notice notice={notice} mailFailed="admin.requests.mailFailed" />
      <section class="ops-card ops-queue-list" aria-label={tr("ops.requests.queue")}>
        <Tabs tabs={tabs} />
        {publicPending ? (
          <p class="ops-note">
            {tr("ops.requests.publicFilter")} <a href={REQUESTS_PATH + qs({ q })}>{tr("ops.requests.publicFilterClear")}</a>
          </p>
        ) : null}
        {interestsPending ? (
          <p class="ops-note">
            {tr("ops.requests.interestsFilter")} <a href={REQUESTS_PATH + qs({ q })}>{tr("ops.requests.publicFilterClear")}</a>
          </p>
        ) : null}
        <SearchForm action={REQUESTS_PATH} q={q} keep={publicPending ? { public: "pending" } : interestsPending ? { interests: "pending" } : { status: tab }} label={tr("ops.requests.search")} placeholder={tr("ops.requests.searchHint")} />
        {items.length === 0 ? (
          <p class="ops-state">{tr(q ? "ops.requests.noMatch" : publicPending ? "ops.requests.publicEmpty" : interestsPending ? "ops.requests.interestsEmpty" : "ops.requests.empty")}</p>
        ) : (
          <>
            <div class="ops-table-wrap">
              <table class="ops-table">
                <thead>
                  <tr>
                    <th scope="col">{tr("ops.requests.col.request")}</th>
                    <th scope="col">{tr("ops.list.status")}</th>
                    <th scope="col">{tr("ops.requests.col.public")}</th>
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
                        <a class="ops-strong" href={`${REQUESTS_PATH}/${item.request.id}${qs(carried)}`}>
                          {item.request.title}
                        </a>
                      </td>
                      <td>
                        <StatusPill status={item.request.status} />
                      </td>
                      <td>{publications.has(item.request.id) ? <PublicPill status={publications.get(item.request.id)!.status} /> : "—"}</td>
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
            <p class="ops-table-foot">{q || publicPending || interestsPending ? tr("ops.list.shown", { n: items.length }) : tr("ops.list.count", { n: items.length, total })}</p>
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
  /** EPIC 27: the Public listing block, present only for a role that may act and a request that has a publication. `form` is a refused form coming back. */
  board?: { publication: PublicationView; form?: BoardFormState; boardOn: boolean };
  /** EPIC 27 (VNX-2706b): the "Interested builders" block, same conditions as `board`. `rows` are the interests of builders who are still public. */
  interests?: { rows: InterestRowView[]; form?: InterestsFormState };
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
  const { shell, item, invites, suggestions, filter, canAct, notice, inviteError, noteError, values, history, board, interests } = props;
  const r = item.request;
  const action = (name: string) => `${REQUESTS_PATH}/${r.id}/${name}${qs(filter)}`;
  const invitable = requestTransition(r.status, "invite", "admin").ok;
  const canReject = r.status === "submitted";
  const canRemove = r.status !== "removed";
  return (
    <OpsLayout {...shell} page={r.title} trail={[tr("ops.group.marketplace"), tr("ops.nav.requests")]} invalid={board?.form !== undefined || interests?.form !== undefined}>
      <a class="ops-back" href={REQUESTS_PATH + qs(filter)}>
        <span aria-hidden="true">←</span>
        {tr("ops.nav.requests")}
      </a>
      <div class="ops-ph ops-ph-row">
        <h1>{r.title}</h1>
        <StatusPill status={r.status} />
      </div>
      <Notice notice={notice} mailFailed="admin.requests.mailFailed" />
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
          {board ? <PublicListingBlock request={r} publication={board.publication} boardOn={board.boardOn} actionBase={`${REQUESTS_PATH}/${r.id}/publication`} query={qs(filter)} form={board.form} /> : null}
          {interests ? (
            <InterestedBuilders
              base={`${REQUESTS_PATH}/${r.id}`}
              rows={interests.rows}
              invitable={invitable && item.activeInvites < MAX_ACTIVE_INVITES}
              query={qs(filter)}
              form={interests.form}
            />
          ) : null}
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
