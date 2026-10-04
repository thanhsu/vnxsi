import type { FC } from "hono/jsx";
import type { ClientRequest } from "../../domain/request.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { REQUEST_STATUS_KEY } from "../labels.ts";

export const RequestList: FC<{ locale: Locale; items: ClientRequest[] }> = ({ locale, items }) => {
  const tr = translator(locale);
  if (items.length === 0) return <p class="muted">{tr("me.requests.empty")}</p>;
  return (
    <div class="table-wrap">
      <table class="data">
        <tbody>
          {items.map((r) => (
            <tr>
              <td>
                <a href={localizedPath(locale, `/me/requests/${r.id}`)}>{r.title}</a>
              </td>
              <td>
                <span class={`badge badge-request-${r.status}`}>{tr(REQUEST_STATUS_KEY[r.status])}</span>
              </td>
              <td class="muted">{r.updatedAt.slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
