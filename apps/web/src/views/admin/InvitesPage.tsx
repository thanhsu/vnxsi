import type { FC } from "hono/jsx";
import { inviteState, type Invite, type InviteState } from "../../domain/invite.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator } from "../../i18n/t.ts";
import { AdminLayout } from "./AdminLayout.tsx";

export type InviteFormValues = { maxUses: string; days: string; note: string };
export type InviteField = keyof InviteFormValues;
export type InviteErrors = Partial<Record<InviteField, true>>;

const STATE_KEY: Record<InviteState, MessageKey> = { active: "invites.status.active", expired: "invites.status.expired", used_up: "invites.status.usedUp" };
const ERROR_KEY: Record<InviteField, MessageKey> = { maxUses: "invites.error.maxUses", days: "invites.error.days", note: "invites.error.note" };

type Props = { locale: Locale; origin: string; invites: Invite[]; now: Date; values: InviteFormValues; errors: InviteErrors; createdLink: string | null };

export const InvitesPage: FC<Props> = (p) => {
  const tr = translator(p.locale);
  const error = (field: InviteField) =>
    p.errors[field] ? (
      <p id={`inv-${field}-error`} class="error-msg">
        {tr(ERROR_KEY[field])}
      </p>
    ) : null;
  const aria = (field: InviteField) => ({ "aria-invalid": p.errors[field] ? "true" : undefined, "aria-describedby": p.errors[field] ? `inv-${field}-error` : undefined });
  return (
    <AdminLayout locale={p.locale} origin={p.origin} title={tr("invites.title")} rest="/admin/invites" active="invites">
      <h1>{tr("invites.title")}</h1>
      <p>{tr("invites.intro")}</p>
      {p.createdLink ? (
        <div class="notice good field" role="status">
          <label for="new-invite">{tr("invites.created")}</label>
          <input id="new-invite" readonly value={p.createdLink} />
        </div>
      ) : null}

      <form method="post" action={localizedPath(p.locale, "/admin/invites")} class="card">
        <div class="field">
          <label for="inv-maxUses">{tr("invites.maxUses")}</label>
          <input id="inv-maxUses" name="maxUses" type="number" min={1} max={1000} step={1} required value={p.values.maxUses} {...aria("maxUses")} />
          {error("maxUses")}
        </div>
        <div class="field">
          <label for="inv-days">{tr("invites.days")}</label>
          <input id="inv-days" name="days" type="number" min={1} max={90} step={1} required value={p.values.days} {...aria("days")} />
          {error("days")}
        </div>
        <div class="field">
          <label for="inv-note">{tr("invites.note")}</label>
          <input id="inv-note" name="note" maxlength={200} value={p.values.note} {...aria("note")} />
          {error("note")}
        </div>
        <button class="btn" type="submit">
          {tr("invites.create")}
        </button>
      </form>

      {p.invites.length === 0 ? (
        <p class="muted">{tr("invites.empty")}</p>
      ) : (
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>{tr("invites.col.note")}</th>
                <th>{tr("invites.col.uses")}</th>
                <th>{tr("invites.col.expires")}</th>
                <th>{tr("invites.col.status")}</th>
              </tr>
            </thead>
            <tbody>
              {p.invites.map((invite) => (
                <tr>
                  <td>{invite.note ?? "—"}</td>
                  <td>
                    {invite.uses}/{invite.maxUses}
                  </td>
                  <td>{invite.expiresAt.slice(0, 10)}</td>
                  <td>{tr(STATE_KEY[inviteState(invite, p.now)])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
};
