import type { FC } from "hono/jsx";
import type { OpsMessageKey } from "../../i18n/messages/en.ts";
import { t } from "../../i18n/t.ts";
import { OpsLayout, type OpsShell } from "./OpsLayout.tsx";

/**
 * /ops Overview (VNX-2503; spec §2.2, §7.3, §7.4; mockups OpsOverview / OpsOverviewMobile). Five work queues and, for
 * roles with overview.detail, the newest audit rows. No metrics, charts or health cards (those are O2). The route
 * decides what each role may see; this view renders only what it is given.
 */

export const QUEUE_IDS = ["builders", "products", "feedback", "requests", "inquiries"] as const;
export type QueueId = (typeof QUEUE_IDS)[number];

export type QueueView =
  | { id: QueueId; state: "error" }
  | {
      id: QueueId;
      state: "ok";
      count: number;
      /** Age of the oldest waiting item in ms; null when it is not shown (Content) or there is none. */
      oldestMs: number | null;
      /** Feedback only: new items whose e-mail to the team has not gone out; null when not shown. */
      unsent: number | null;
      /** The queue's list page, only when that route exists and the role may open it. */
      href: string | null;
    };

export type ActivityActor = { kind: "system" } | { kind: "email"; email: string } | { kind: "id"; id: string };

export interface ActivityRow {
  id: string;
  at: string;
  actor: ActivityActor;
  action: string;
  entity: string;
  entityId: string | null;
}

/** `hidden`: the role has no overview.detail (Content), so the section is not rendered at all. */
export type ActivityView = { state: "hidden" } | { state: "error" } | { state: "ok"; rows: ActivityRow[] };

export type OverviewPageProps = {
  shell: OpsShell;
  queues: QueueView[];
  /** When the counts were read (ISO, UTC). */
  readAt: string;
  activity: ActivityView;
};

const tr = (key: OpsMessageKey, params?: Record<string, string | number>) => t("en", key, params);

const QUEUE_LABEL: Record<QueueId, OpsMessageKey> = {
  builders: "ops.queue.builders",
  products: "ops.queue.products",
  feedback: "ops.queue.feedback",
  requests: "ops.queue.requests",
  inquiries: "ops.queue.inquiries",
};
const QUEUE_LINK: Record<QueueId, OpsMessageKey> = {
  builders: "ops.queue.open",
  products: "ops.queue.open",
  feedback: "ops.queue.openInbox",
  requests: "ops.queue.open",
  inquiries: "ops.queue.viewInquiries",
};

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "2 days", "9 hours", "35 minutes", whole units rounded down. */
export function formatAge(ms: number): string {
  const plural = (n: number, one: OpsMessageKey, other: OpsMessageKey) => (n === 1 ? tr(one) : tr(other, { n }));
  if (ms >= DAY) return plural(Math.floor(ms / DAY), "ops.age.day.one", "ops.age.day.other");
  if (ms >= HOUR) return plural(Math.floor(ms / HOUR), "ops.age.hour.one", "ops.age.hour.other");
  if (ms >= MINUTE) return plural(Math.floor(ms / MINUTE), "ops.age.minute.one", "ops.age.minute.other");
  return tr("ops.age.underMinute");
}

/** HH:MM in UTC; earlier days also carry the date. */
function clock(iso: string, today: string): string {
  const hm = iso.slice(11, 16);
  return iso.slice(0, 10) === today ? hm : `${iso.slice(0, 10)} ${hm}`;
}

/** Long IDs are shortened as in the mockup ("01J9…X2KQ"); the full value stays in the title. */
const Id: FC<{ value: string }> = ({ value }) => (
  <span class="ops-mono" title={value}>
    {value.length > 12 ? `${value.slice(0, 4)}…${value.slice(-4)}` : value}
  </span>
);

export const AlertIcon: FC = () => (
  <svg class="ops-icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
    <path d="M12 4l9 16H3zM12 10v4M12 17v.5" />
  </svg>
);

const QueueCard: FC<{ queue: QueueView }> = ({ queue }) => {
  const label = <span class="ops-queue-label">{tr(QUEUE_LABEL[queue.id])}</span>;
  if (queue.state === "error") {
    return (
      <div class="ops-card ops-queue" data-queue={queue.id} data-state="error">
        {label}
        <span class="ops-queue-num ops-queue-num-none" aria-hidden="true">
          –
        </span>
        <span class="ops-queue-error">
          <AlertIcon />
          {tr("ops.queue.error")}
        </span>
      </div>
    );
  }
  const zero = queue.count === 0;
  return (
    <div class="ops-card ops-queue" data-queue={queue.id} data-state={zero ? "zero" : "count"}>
      {label}
      <span class="ops-queue-num">{queue.count}</span>
      {zero ? <span class="ops-queue-meta">{tr("ops.queue.nothing")}</span> : null}
      {!zero && queue.oldestMs !== null ? <span class="ops-queue-meta">{tr("ops.queue.oldest", { age: formatAge(queue.oldestMs) })}</span> : null}
      {queue.unsent ? (
        <span class="ops-queue-meta ops-queue-warn">{queue.unsent === 1 ? tr("ops.queue.unsent.one") : tr("ops.queue.unsent.other", { n: queue.unsent })}</span>
      ) : null}
      {queue.href ? (
        <a class="ops-queue-link" href={queue.href}>
          {tr(QUEUE_LINK[queue.id])} <span aria-hidden="true">→</span>
        </a>
      ) : null}
    </div>
  );
};

export const ActorCell: FC<{ actor: ActivityActor }> = ({ actor }) => {
  if (actor.kind === "system") return <span class="ops-muted">{tr("ops.activity.system")}</span>;
  if (actor.kind === "email") return <span class="ops-break">{actor.email}</span>;
  return <Id value={actor.id} />;
};

const Activity: FC<{ activity: Exclude<ActivityView, { state: "hidden" }>; today: string }> = ({ activity, today }) => (
  <section class="ops-card ops-activity" aria-labelledby="ops-activity-h">
    <h2 id="ops-activity-h" class="ops-section-h">
      {tr("ops.activity.title")}
    </h2>
    {activity.state === "error" ? (
      <p class="ops-state ops-state-error">
        <AlertIcon />
        {tr("ops.activity.error")}
      </p>
    ) : activity.rows.length === 0 ? (
      <p class="ops-state">{tr("ops.activity.empty")}</p>
    ) : (
      <>
        <div class="ops-table-wrap">
          <table class="ops-table">
            <thead>
              <tr>
                <th scope="col">{tr("ops.activity.time")}</th>
                <th scope="col">{tr("ops.activity.actor")}</th>
                <th scope="col">{tr("ops.activity.action")}</th>
                <th scope="col">{tr("ops.activity.entity")}</th>
                <th scope="col">{tr("ops.activity.id")}</th>
              </tr>
            </thead>
            <tbody>
              {activity.rows.map((row) => (
                <tr data-audit={row.id}>
                  <td class="ops-mono ops-nowrap">
                    <time datetime={row.at}>{clock(row.at, today)}</time>
                  </td>
                  <td>
                    <ActorCell actor={row.actor} />
                  </td>
                  <td class="ops-mono">{row.action}</td>
                  <td>{row.entity}</td>
                  <td>{row.entityId ? <Id value={row.entityId} /> : <span class="ops-muted">–</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p class="ops-table-foot">{activity.rows.length === 1 ? tr("ops.activity.latest.one") : tr("ops.activity.latest.other", { n: activity.rows.length })}</p>
      </>
    )}
  </section>
);

export const OverviewPage: FC<OverviewPageProps> = ({ shell, queues, readAt, activity }) => {
  const [before, after] = tr("ops.overview.readAt").split("{time}");
  return (
    <OpsLayout {...shell} page={tr("ops.overview.title")}>
      <div class="ops-ph">
        <h1>{tr("ops.overview.title")}</h1>
        <p>{tr("ops.overview.lead")}</p>
      </div>
      <section class="ops-queues" aria-label={tr("ops.overview.queues")}>
        {queues.map((queue) => (
          <QueueCard queue={queue} />
        ))}
      </section>
      <p class="ops-readat">
        {before}
        <time datetime={readAt}>{readAt.slice(11, 16)}</time>
        {after}
      </p>
      {activity.state === "hidden" ? null : <Activity activity={activity} today={readAt.slice(0, 10)} />}
    </OpsLayout>
  );
};
