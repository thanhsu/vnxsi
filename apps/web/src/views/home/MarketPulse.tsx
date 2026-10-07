import type { FC } from "hono/jsx";
import { REQUEST_DAYS, type CategoryRow, type GrowthPoint } from "../../domain/public-stats.ts";
import type { Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { formatCount } from "../format.ts";
import { CATEGORY_KEY } from "../labels.ts";

type Props = { locale: Locale; categories: readonly CategoryRow[] | null; scarcest: CategoryRow | null; growth: readonly GrowthPoint[] | null };

/** Tables for now (Task 8 draws the charts and keeps these as the equivalent data). */
export const MarketPulse: FC<Props> = ({ locale, categories, scarcest, growth }) => {
  const tr = translator(locale);
  return (
    <div class="home-pulse-grid">
      {categories ? (
        <div class="table-wrap">
          <table class="data" data-chart="requests-by-category">
            <caption>{tr("home.pulse.requestsTitle")}</caption>
            <thead>
              <tr>
                <th scope="col">{tr("home.pulse.category")}</th>
                <th scope="col">{tr("home.pulse.requests", { days: REQUEST_DAYS })}</th>
                <th scope="col">{tr("home.pulse.products")}</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((row) => (
                <tr>
                  <th scope="row">{tr(CATEGORY_KEY[row.category])}</th>
                  <td>{formatCount(locale, row.requests)}</td>
                  <td>{formatCount(locale, row.products)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {scarcest ? (
            <p class="home-scarcest">
              <span class="muted">{tr("home.pulse.scarcest")}</span> <strong>{tr(CATEGORY_KEY[scarcest.category])}</strong>
            </p>
          ) : null}
        </div>
      ) : null}
      {growth ? (
        <div class="table-wrap">
          <table class="data" data-chart="growth">
            <caption>{tr("home.pulse.growthTitle")}</caption>
            <thead>
              <tr>
                <th scope="col">{tr("home.pulse.week")}</th>
                <th scope="col">{tr("home.numbers.products")}</th>
                <th scope="col">{tr("home.numbers.builders")}</th>
              </tr>
            </thead>
            <tbody>
              {growth.map((point) => (
                <tr>
                  <th scope="row">{point.week}</th>
                  <td>{formatCount(locale, point.products)}</td>
                  <td>{formatCount(locale, point.builders)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
};
