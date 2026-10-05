import type { FC } from "hono/jsx";
import { BUILDER_STATUSES, type BuilderAccount, type BuilderAction, type BuilderStatus } from "../../domain/builder.ts";
import { countryName } from "../country.ts";
import type { OpsMessageKey } from "../../i18n/messages/en.ts";
import { KIND_KEY, USER_STATUS_KEY } from "../labels.ts";
import { PlainText } from "../PlainText.tsx";
import { OpsLayout, type OpsShell } from "./OpsLayout.tsx";
import { Confirm, History, Notice, Pill, PostButton, qs, ReasonField, SearchForm, Tabs, tr, utc, type HistoryView, type OpsNotice, type PillTone } from "./parts.tsx";

/**
 * /ops/marketplace/builders and its detail page (VNX-2504a; spec §7.3; mockup OpsBuilders). The mockup's right-hand
 * panel is its own page here, with a link back to the list that keeps the filter. Actions only when `canAct`.
 */

export const BUILDERS_PATH = "/ops/marketplace/builders";

/** The list filter, from the URL (allowlisted by the route). On a detail page only the values that were given. */
export type BuilderFilter = { status?: BuilderStatus; q?: string };

const TONE: Record<BuilderStatus, PillTone> = { pending: "pending", approved: "ok", rejected: "bad", suspended: "bad" };
/** The states by their own names (the labels in labels.ts are worded for the builder). */
const STATUS_KEY: Record<BuilderStatus, OpsMessageKey> = {
  pending: "ops.builders.status.pending",
  approved: "ops.builders.status.approved",
  rejected: "ops.builders.status.rejected",
  suspended: "ops.builders.status.suspended",
};
const StatusPill: FC<{ status: BuilderStatus }> = ({ status }) => <Pill tone={TONE[status]} label={tr(STATUS_KEY[status])} />;

type ListProps = { shell: OpsShell; status: BuilderStatus; q: string | null; counts: Partial<Record<BuilderStatus, number>>; builders: BuilderAccount[] };

export const BuildersListPage: FC<ListProps> = ({ shell, status, q, counts, builders }) => {
  const filter = { status, q: q ?? undefined };
  const total = counts[status] ?? 0;
  return (
    <OpsLayout {...shell} page={tr("ops.nav.builders")} trail={[tr("ops.group.marketplace")]}>
      <div class="ops-ph">
        <h1>{tr("ops.nav.builders")}</h1>
        <p>{tr("ops.builders.lead")}</p>
      </div>
      <section class="ops-card ops-queue-list" aria-label={tr("ops.builders.queue")}>
        <Tabs tabs={BUILDER_STATUSES.map((s) => ({ href: BUILDERS_PATH + qs({ status: s, q }), label: tr(STATUS_KEY[s]), count: counts[s] ?? 0, current: s === status }))} />
        <SearchForm action={BUILDERS_PATH} q={q} keep={{ status }} label={tr("ops.builders.search")} placeholder={tr("ops.builders.searchHint")} />
        {builders.length === 0 ? (
          <p class="ops-state">{tr(q ? "ops.builders.noMatch" : "ops.builders.empty")}</p>
        ) : (
          <>
            <div class="ops-table-wrap">
              <table class="ops-table">
                <thead>
                  <tr>
                    <th scope="col">{tr("ops.builders.col.builder")}</th>
                    <th scope="col">{tr("admin.col.handle")}</th>
                    <th scope="col">{tr("admin.col.email")}</th>
                    <th scope="col">{tr("admin.col.country")}</th>
                    <th scope="col">{tr("admin.col.created")}</th>
                    <th scope="col">{tr("admin.col.invite")}</th>
                    <th scope="col">{tr("ops.list.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {builders.map((b) => (
                    <tr>
                      <td>
                        <a class="ops-strong" href={`${BUILDERS_PATH}/${b.userId}${qs(filter)}`}>
                          {b.name}
                        </a>
                      </td>
                      <td class="ops-mono">{b.handle}</td>
                      <td>{b.email}</td>
                      <td>{countryName("en", b.country)}</td>
                      <td class="ops-mono">{b.createdAt.slice(0, 10)}</td>
                      <td>{tr(b.inviteCodeHash ? "admin.yes" : "admin.no")}</td>
                      <td>
                        <StatusPill status={b.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p class="ops-table-foot">{q ? tr("ops.list.shown", { n: builders.length }) : tr("ops.list.count", { n: builders.length, total })}</p>
          </>
        )}
      </section>
    </OpsLayout>
  );
};

type DetailProps = {
  shell: OpsShell;
  builder: BuilderAccount;
  filter: BuilderFilter;
  canAct: boolean;
  notice: OpsNotice;
  reasonError?: BuilderAction;
  history: HistoryView;
};

export const BuilderDetailPage: FC<DetailProps> = ({ shell, builder: b, filter, canAct, notice, reasonError, history }) => {
  const action = (name: BuilderAction) => `${BUILDERS_PATH}/${b.userId}/${name}${qs(filter)}`;
  const error = (name: BuilderAction) => (reasonError === name ? tr("admin.error.reason") : null);
  return (
    <OpsLayout {...shell} page={b.name} trail={[tr("ops.group.marketplace"), tr("ops.nav.builders")]}>
      <a class="ops-back" href={BUILDERS_PATH + qs(filter)}>
        <span aria-hidden="true">← </span>
        {tr("ops.builders.back")}
      </a>
      <div class="ops-ph ops-ph-row">
        <h1>{b.name}</h1>
        <StatusPill status={b.status} />
      </div>
      <Notice notice={notice} />
      <div class="ops-split">
        <section class="ops-card ops-sec" aria-labelledby="ops-profile-h">
          <h2 id="ops-profile-h">{tr("ops.detail.profile")}</h2>
          <dl class="ops-dl">
            <dt>{tr("admin.col.handle")}</dt>
            <dd class="ops-mono">{b.handle}</dd>
            <dt>{tr("admin.col.email")}</dt>
            <dd class="ops-break">{b.email}</dd>
            <dt>{tr("admin.col.account")}</dt>
            <dd>{tr(USER_STATUS_KEY[b.userStatus])}</dd>
            <dt>{tr("builder.field.kind")}</dt>
            <dd>{tr(KIND_KEY[b.kind])}</dd>
            <dt>{tr("builder.field.headline")}</dt>
            <dd>{b.headline}</dd>
            <dt>{tr("admin.col.country")}</dt>
            <dd>{countryName("en", b.country)}</dd>
            <dt>{tr("builder.field.websiteUrl")}</dt>
            <dd class="ops-break">
              {b.websiteUrl ? (
                <a href={b.websiteUrl} rel="nofollow ugc noopener" target="_blank">
                  {b.websiteUrl}
                </a>
              ) : (
                "—"
              )}
            </dd>
            <dt>{tr("builder.field.skills")}</dt>
            <dd>{b.skills.join(", ") || "—"}</dd>
            <dt>{tr("admin.col.invite")}</dt>
            <dd>{tr(b.inviteCodeHash ? "admin.yes" : "admin.no")}</dd>
            <dt>{tr("admin.col.created")}</dt>
            <dd class="ops-mono">{utc(b.createdAt)}</dd>
          </dl>
          <h3>{tr("ops.builders.bio")}</h3>
          <PlainText text={b.bio} />
          {b.reviewNote ? (
            <>
              <h3>{tr("ops.detail.reviewNote")}</h3>
              <PlainText text={b.reviewNote} />
            </>
          ) : null}
        </section>
        <div class="ops-stack">
          <section class="ops-card ops-sec" aria-labelledby="ops-decision-h">
            <h2 id="ops-decision-h">{tr("ops.detail.decision")}</h2>
            {!canAct ? (
              <p class="ops-muted">{tr("ops.detail.viewOnly")}</p>
            ) : b.status === "pending" ? (
              <>
                <div class="ops-actions">
                  <PostButton action={action("approve")} label={tr("admin.approve")} primary />
                  <Confirm summary={tr("ops.builders.rejectOpen")} open={reasonError === "reject"}>
                    <form method="post" action={action("reject")}>
                      <ReasonField id="reject-reason" name="reason" label={tr("admin.reason")} max={500} required error={error("reject")} />
                      <p class="ops-note">{tr("ops.builders.rejectHelp", { name: b.name })}</p>
                      <button class="ops-btn ops-btn-danger" type="submit">
                        {tr("ops.builders.rejectConfirm")}
                      </button>
                    </form>
                  </Confirm>
                </div>
                <p class="ops-note">{tr("ops.builders.approveHelp")}</p>
              </>
            ) : b.status === "approved" ? (
              <Confirm summary={tr("ops.builders.suspendOpen")} open={reasonError === "suspend"}>
                <form method="post" action={action("suspend")}>
                  <ReasonField id="suspend-reason" name="reason" label={tr("ops.builders.suspendReason")} max={500} required={false} error={error("suspend")} />
                  <p class="ops-note">{tr("ops.builders.suspendHelp", { name: b.name })}</p>
                  <button class="ops-btn ops-btn-danger" type="submit">
                    {tr("ops.builders.suspendConfirm")}
                  </button>
                </form>
              </Confirm>
            ) : b.status === "suspended" ? (
              <PostButton action={action("unsuspend")} label={tr("admin.unsuspend")} />
            ) : (
              <p class="ops-muted">{tr("ops.detail.noAction")}</p>
            )}
          </section>
          <History history={history} empty={tr("ops.builders.noHistory")} />
        </div>
      </div>
    </OpsLayout>
  );
};
