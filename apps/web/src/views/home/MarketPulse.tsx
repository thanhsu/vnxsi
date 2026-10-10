import type { FC } from "hono/jsx";
import { REQUEST_DAYS, type CategoryRow, type GrowthPoint } from "../../domain/public-stats.ts";
import type { Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { BarChart, ChartData, LineChart } from "../Chart.tsx";
import { formatCount, formatWeeks } from "../format.ts";
import { CATEGORY_KEY } from "../labels.ts";

type Props = { locale: Locale; categories: readonly CategoryRow[] | null; scarcest: CategoryRow | null; growth: readonly GrowthPoint[] | null };

/** Two SVG charts; each keeps the 7b table inside a closed <details> as its equivalent data. */
export const MarketPulse: FC<Props> = ({ locale, categories, scarcest, growth }) => {
  const tr = translator(locale);
  const weekLabels = growth ? formatWeeks(locale, growth.map((p) => p.week)) : [];
  return (
    <div class="home-pulse-grid">
      {categories ? (
        <div class="home-pulse-item">
          <BarChart
            locale={locale}
            title={tr("home.pulse.requestsTitle")}
            series={[
              { tone: "blue", label: tr("home.pulse.requests", { days: REQUEST_DAYS }) },
              { tone: "orange", label: tr("home.pulse.products") },
            ]}
            rows={categories.map((row) => ({ label: tr(CATEGORY_KEY[row.category]), values: [row.requests, row.products] }))}
          >
            <ChartData summary={tr("home.chart.table")}>
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
              </div>
            </ChartData>
          </BarChart>
          {scarcest ? (
            <p class="home-scarcest">
              <span class="muted">{tr("home.pulse.scarcest")}</span> <strong>{tr(CATEGORY_KEY[scarcest.category])}</strong>
            </p>
          ) : null}
        </div>
      ) : null}
      {growth ? (
        <div class="home-pulse-item">
          <LineChart
            locale={locale}
            title={tr("home.pulse.growthTitle")}
            series={[
              { tone: "orange", label: tr("home.numbers.products"), mark: "square" },
              { tone: "blue", label: tr("home.numbers.builders"), mark: "circle" },
            ]}
            labels={weekLabels}
            values={[growth.map((p) => p.products), growth.map((p) => p.builders)]}
          >
            <ChartData summary={tr("home.chart.table")}>
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
                    {growth.map((point, i) => (
                      <tr>
                        <th scope="row">{weekLabels[i]}</th>
                        <td>{formatCount(locale, point.products)}</td>
                        <td>{formatCount(locale, point.builders)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartData>
          </LineChart>
        </div>
      ) : null}
    </div>
  );
};
