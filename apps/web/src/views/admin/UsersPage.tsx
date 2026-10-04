import type { FC } from "hono/jsx";
import type { UserSummary } from "../../domain/user.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { STATUS_KEY, USER_STATUS_KEY } from "../labels.ts";
import { AdminLayout } from "./AdminLayout.tsx";

type Props = { locale: Locale; origin: string; query: string; users: UserSummary[]; currentUserId: string };

export const UsersPage: FC<Props> = (p) => {
  const tr = translator(p.locale);
  const base = localizedPath(p.locale, "/admin/users");
  return (
    <AdminLayout locale={p.locale} origin={p.origin} title={tr("users.title")} rest="/admin/users" active="users">
      <h1>{tr("users.title")}</h1>
      <form method="get" action={base} class="row-actions">
        <label for="user-q">{tr("users.search")}</label>
        <input id="user-q" name="q" type="search" value={p.query} maxlength={254} />
        <button class="btn" type="submit">
          {tr("users.searchSubmit")}
        </button>
      </form>
      {p.users.length === 0 ? (
        <p class="muted">{tr("users.empty")}</p>
      ) : (
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>{tr("admin.col.email")}</th>
                <th>{tr("users.col.status")}</th>
                <th>{tr("users.col.admin")}</th>
                <th>{tr("users.col.builder")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {p.users.map((u) => (
                <tr>
                  <td>{u.email}</td>
                  <td>{tr(USER_STATUS_KEY[u.status])}</td>
                  <td>{tr(u.isAdmin ? "admin.yes" : "admin.no")}</td>
                  <td>
                    {u.builderHandle && u.builderStatus ? (
                      <a href={localizedPath(p.locale, `/admin/builders/${u.id}`)}>
                        {u.builderHandle} ({tr(STATUS_KEY[u.builderStatus])})
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {u.id === p.currentUserId ? null : (
                      <form method="post" action={`${base}/${u.id}/${u.status === "active" ? "suspend" : "unsuspend"}`}>
                        <button class="link" type="submit">
                          {tr(u.status === "active" ? "admin.suspend" : "admin.unsuspend")}
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
};
