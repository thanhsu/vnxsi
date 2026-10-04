import type { FC } from "hono/jsx";
import type { InquirySummary } from "../../domain/inquiry.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { INQUIRY_STATUS_KEY, INQUIRY_TYPE_KEY } from "../labels.ts";

/** The inbox table: the builder sees "From <client name>", the client sees "To <builder name>". */
export const InquiryList: FC<{ locale: Locale; items: InquirySummary[]; viewer: "builder" | "client"; base: string }> = ({ locale, items, viewer, base }) => {
  const tr = translator(locale);
  if (items.length === 0) return <p class="muted">{tr("inbox.empty")}</p>;
  return (
    <div class="table-wrap">
      <table class="data">
        <tbody>
          {items.map(({ inquiry, productName, builderName }) => (
            <tr>
              <td>
                <a href={localizedPath(locale, `${base}/${inquiry.id}`)}>{viewer === "builder" ? tr("inbox.from", { name: inquiry.clientName }) : tr("inbox.to", { name: builderName })}</a>
              </td>
              <td>
                {tr(INQUIRY_TYPE_KEY[inquiry.type])}
                {productName ? ` · ${productName}` : null}
              </td>
              <td>
                <span class={`badge badge-inquiry-${inquiry.status}`}>{tr(INQUIRY_STATUS_KEY[inquiry.status])}</span>
              </td>
              <td class="muted">{inquiry.lastActivityAt.slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
