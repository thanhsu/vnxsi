import type { FC, PropsWithChildren } from "hono/jsx";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { t } from "../../i18n/t.ts";
import { ActorCell, AlertIcon, type ActivityRow } from "./OverviewPage.tsx";

/**
 * Pieces shared by the Ops queues and their detail pages (VNX-2504a; spec §7.3; mockup OpsBuilders): status tabs with
 * counts, the search form, status pills, notices, the no-JS confirmation and the audit History. English only.
 */

export const tr = (key: MessageKey, params?: Record<string, string | number>) => t("en", key, params);

/** "?a=1&b=2" from the set values, in the given order; "" when none is set. */
export function qs(params: Record<string, string | null | undefined>): string {
  const query = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => typeof e[1] === "string")).toString();
  return query ? `?${query}` : "";
}

/** "2026-10-03 08:12 UTC". */
export const utc = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;

export type PillTone = "pending" | "ok" | "bad" | "info" | "mute";
export const Pill: FC<{ tone: PillTone; label: string }> = ({ tone, label }) => <span class={`ops-st ops-st-${tone}`}>{label}</span>;

export interface TabLink {
  href: string;
  label: string;
  count: number | null;
  current: boolean;
}

export const Tabs: FC<{ tabs: TabLink[] }> = ({ tabs }) => (
  <nav class="ops-tabs" aria-label={tr("ops.list.statusFilter")}>
    {tabs.map((tab) => (
      <a class="ops-tab" href={tab.href} aria-current={tab.current ? "page" : undefined}>
        {tab.label}
        {tab.count === null ? null : <> <span class="ops-tab-n">{tab.count}</span></>}
      </a>
    ))}
  </nav>
);

/** A GET form: the search stays in the URL; `keep` carries the current tab. */
export const SearchForm: FC<{ action: string; q: string | null; keep: Record<string, string>; label: string; placeholder: string }> = (p) => (
  <form class="ops-bar" method="get" action={p.action} role="search">
    {Object.entries(p.keep).map(([name, value]) => (
      <input type="hidden" name={name} value={value} />
    ))}
    <input class="ops-in ops-grow" type="search" name="q" value={p.q ?? ""} maxlength={100} aria-label={p.label} placeholder={p.placeholder} />
    <button class="ops-btn" type="submit">
      {tr("ops.list.search")}
    </button>
  </form>
);

export type OpsNotice = "done" | "mail_failed" | "conflict" | null;

export const Notice: FC<{ notice: OpsNotice }> = ({ notice }) =>
  notice === "done" ? (
    <p class="ops-notice ops-notice-ok" role="status">
      {tr("admin.done")}
    </p>
  ) : notice ? (
    <p class="ops-notice ops-notice-warn" role="alert">
      <AlertIcon />
      {tr(notice === "mail_failed" ? "admin.mailFailed" : "ops.notice.conflict")}
    </p>
  ) : null;

/** A dangerous action behind a no-JS confirmation: the form only shows once the <details> is opened. */
export const Confirm: FC<PropsWithChildren<{ summary: string; open?: boolean }>> = ({ summary, open, children }) => (
  <details class="ops-confirm" open={open}>
    <summary class="ops-btn ops-btn-danger">{summary}</summary>
    <div class="ops-confirm-body">{children}</div>
  </details>
);

/** A textarea for a reason or note, with its error message when the server refused the value. */
export const ReasonField: FC<{ id: string; name: string; label: string; max: number; required: boolean; error: string | null }> = (p) => (
  <div class="ops-field">
    <label for={p.id}>{p.label}</label>
    <textarea
      class="ops-in"
      id={p.id}
      name={p.name}
      rows={3}
      maxlength={p.max}
      required={p.required}
      aria-invalid={p.error ? "true" : undefined}
      aria-describedby={p.error ? `${p.id}-error` : undefined}
    ></textarea>
    {p.error ? (
      <p id={`${p.id}-error`} class="ops-field-error">
        {p.error}
      </p>
    ) : null}
  </div>
);

export const PostButton: FC<{ action: string; label: string; primary?: boolean }> = ({ action, label, primary }) => (
  <form method="post" action={action}>
    <button class={primary ? "ops-btn ops-btn-primary" : "ops-btn"} type="submit">
      {label}
    </button>
  </form>
);

export type HistoryView = { state: "error" } | { state: "ok"; rows: ActivityRow[] };

/** The object's audit rows in the safe projection of VNX-2503 (time, actor, action), never `data` (spec §4). */
export const History: FC<{ history: HistoryView; empty: string }> = ({ history, empty }) => (
  <section class="ops-card ops-history" aria-labelledby="ops-history-h">
    <h2 id="ops-history-h" class="ops-section-h">
      {tr("ops.history.title")}
    </h2>
    {history.state === "error" ? (
      <p class="ops-state ops-state-error">
        <AlertIcon />
        {tr("ops.history.error")}
      </p>
    ) : history.rows.length === 0 ? (
      <p class="ops-state">{empty}</p>
    ) : (
      <ol class="ops-tl">
        {history.rows.map((row) => (
          <li data-audit={row.id}>
            <time class="ops-mono" datetime={row.at}>
              {utc(row.at)}
            </time>
            <span>
              <span class="ops-mono">{row.action}</span> · <ActorCell actor={row.actor} />
            </span>
          </li>
        ))}
      </ol>
    )}
  </section>
);
