import type { FC } from "hono/jsx";
import { BUILDER_DAYS, MIN, type TopBuilders } from "../../domain/public-stats.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator } from "../../i18n/t.ts";
import { formatCount, formatDuration } from "../format.ts";

const TABS = [
  { key: "selected", title: "home.builders.selected", value: "home.builders.value.selected", criteria: "home.builders.criteria.selected", min: MIN.selected },
  { key: "fast", title: "home.builders.fast", value: "home.builders.value.fast", criteria: "home.builders.criteria.fast", min: MIN.fastSamples },
  { key: "verified", title: "home.builders.verified", value: "home.builders.value.verified", criteria: "home.builders.criteria.verified", min: MIN.verified },
] as const satisfies readonly { key: keyof TopBuilders; title: MessageKey; value: MessageKey; criteria: MessageKey; min: number }[];

/** One table per tab that has enough builders (the domain returns null for the others); each states its own criteria, and the note travels with the body. */
export const TopBuildersBlock: FC<{ locale: Locale; data: TopBuilders }> = ({ locale, data }) => {
  const tr = translator(locale);
  return (
    <>
      <p class="home-note">{tr("home.builders.noPay")}</p>
      {TABS.map((tab) => {
        const rows = data[tab.key];
        return rows ? (
          <div class="table-wrap home-group" data-tab={tab.key}>
            <h3>{tr(tab.title)}</h3>
            <p class="home-criteria">{tr(tab.criteria, { days: BUILDER_DAYS, min: tab.min })}</p>
            <table class="data">
              <thead>
                <tr>
                  <th scope="col">{tr("home.builders.name")}</th>
                  <th scope="col">{tr(tab.value)}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr>
                    <th scope="row"><a href={localizedPath(locale, `/b/${row.handle}`)}>{row.name}</a></th>
                    <td>{tab.key === "fast" ? formatDuration(locale, row.value) : formatCount(locale, row.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null;
      })}
    </>
  );
};
