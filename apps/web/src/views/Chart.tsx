import type { FC, PropsWithChildren } from "hono/jsx";
import type { Locale } from "../i18n/locales.ts";
import { BAR_HEIGHT, MARKER_MIN_STEP, barLayout, lineLayout, linePoints } from "./chart-geometry.ts";
import { formatCount, PATH_LENGTH } from "./format.ts";

export type Tone = "blue" | "orange";
export type Series = { tone: Tone; label: string; mark?: "circle" | "square" };

/** The tooltip text of one group (Task 8b shows it): "Label: Series 4 · Series 1". Also what a screen reader never needs: the table has it all. */
const tip = (locale: Locale, head: string, series: readonly Series[], values: readonly number[]): string =>
  `${head}: ${series.map((s, i) => `${s.label} ${formatCount(locale, values[i] ?? 0)}`).join(" · ")}`;

const Legend: FC<{ series: readonly Series[] }> = ({ series }) =>
  series.length > 1 ? (
    <ul class="chart-legend">
      {series.map((s) => (
        <li>
          <span class={`chart-swatch chart-tone-${s.tone}${s.mark === "circle" ? " chart-mark-circle" : ""}`} aria-hidden="true"></span>
          {s.label}
        </li>
      ))}
    </ul>
  ) : null;

/** A chart's equivalent table, closed by default; the table itself is the child. */
export const ChartData: FC<PropsWithChildren<{ summary: string }>> = ({ summary, children }) => (
  <details class="chart-data">
    <summary>{summary}</summary>
    {children}
  </details>
);

type BarProps = { locale: Locale; title: string; series: readonly Series[]; rows: readonly { label: string; values: readonly number[] }[] };
export const BarChart: FC<PropsWithChildren<BarProps>> = ({ locale, title, series, rows, children }) => {
  const g = barLayout(rows.map((r) => r.values));
  return (
    <figure class="chart" data-chart-kind="bars">
      <Legend series={series} />
      <svg class="chart-svg" viewBox={`0 0 ${g.width} ${g.height}`} role="img" aria-label={title}>
        <line class="chart-axis" x1={g.left} y1="0" x2={g.left} y2={g.height} />
        {rows.map((row, i) => {
          const r = g.rows[i]!;
          return (
            <g class="chart-group" data-tip={tip(locale, row.label, series, row.values)}>
              <rect class="chart-hit" x="0" y={r.top} width={g.width} height={r.height} />
              <text class="chart-label" x={g.left} y={r.labelY}>{row.label}</text>
              {r.bars.map((b, j) => (
                <>
                  <rect class={`chart-bar chart-tone-${series[j]!.tone}`} x={g.left} y={b.y} width={b.width} height={BAR_HEIGHT} rx="2" />
                  <text class="chart-value" x={b.textX} y={b.textY}>{formatCount(locale, row.values[j] ?? 0)}</text>
                </>
              ))}
            </g>
          );
        })}
      </svg>
      {children}
    </figure>
  );
};

type LineProps = { locale: Locale; title: string; series: readonly Series[]; labels: readonly string[]; values: readonly (readonly number[])[] };
/** `values[s][i]` is series s at label i. `mark: "square"` draws squares; anything else, circles. */
export const LineChart: FC<PropsWithChildren<LineProps>> = ({ locale, title, series, labels, values, children }) => {
  const g = lineLayout(values);
  const last = labels.length - 1;
  const ends = last > 0 ? [0, last] : [0];
  return (
    <figure class="chart" data-chart-kind="lines">
      <Legend series={series} />
      <svg class="chart-svg" viewBox={`0 0 ${g.width} ${g.height}`} role="img" aria-label={title}>
        {g.ticks.map((tick) => (
          <>
            <line class="chart-grid" x1={g.left} y1={tick.y} x2={g.right} y2={tick.y} />
            <text class="chart-axis-label" x={g.left - 6} y={tick.y + 4} text-anchor="end">{formatCount(locale, tick.value)}</text>
          </>
        ))}
        {ends.map((i) => (
          <text class="chart-axis-label" x={g.x[i]} y={g.height - 6} text-anchor={i === 0 ? "start" : "end"}>{labels[i]}</text>
        ))}
        {labels.map((label, i) => (
          <g class="chart-group" data-tip={tip(locale, label, series, values.map((s) => s[i] ?? 0))}>
            <rect class="chart-hit" x={(g.x[i] ?? 0) - g.step / 2} y={g.top} width={g.step || g.width} height={g.baseline - g.top} />
            <line class="chart-cross" x1={g.x[i]} y1={g.top} x2={g.x[i]} y2={g.baseline} />
          </g>
        ))}
        {series.map((s, k) => (
          <>
            <polyline class={`chart-line chart-tone-${s.tone}`} points={linePoints(g.lines[k]!)} pathLength={PATH_LENGTH} />
            {g.lines[k]!.filter((_, i) => g.step >= MARKER_MIN_STEP || i === 0 || i === last).map((p) =>
              s.mark === "square" ? (
                <rect class={`chart-dot chart-tone-${s.tone}`} x={p.x - 3} y={p.y - 3} width="6" height="6" />
              ) : (
                <circle class={`chart-dot chart-tone-${s.tone}`} cx={p.x} cy={p.y} r="3" />
              ),
            )}
          </>
        ))}
      </svg>
      {children}
    </figure>
  );
};
