/** Pure geometry for the hand-built SVG charts (VNX-0704a). No DOM, no colour: colour lives in CSS classes. */
export const CHART_WIDTH = 320;
const PAD = 4;
const BAR = { label: 16, height: 10, gap: 4, group: 14, value: 40 } as const;
export const BAR_HEIGHT = BAR.height;
/** Below this x step (px in the viewBox) markers crowd the line: only the two endpoints keep one. */
export const MARKER_MIN_STEP = 12;
const round = (n: number): number => Math.round(n * 10) / 10;

export type BarRowLayout = { top: number; height: number; labelY: number; bars: { y: number; width: number; textX: number; textY: number }[] };
export type BarLayout = { width: number; height: number; left: number; rows: BarRowLayout[] };

/** Horizontal grouped bars: one group per row, its label above it, one bar per series; every bar scaled to the largest value. */
export function barLayout(values: readonly (readonly number[])[]): BarLayout {
  const series = Math.max(1, ...values.map((v) => v.length));
  const max = Math.max(1, ...values.flat());
  const span = CHART_WIDTH - 2 * PAD - BAR.value;
  const groupH = BAR.label + series * BAR.height + (series - 1) * BAR.gap;
  const rows = values.map((row, i): BarRowLayout => {
    const top = PAD + i * (groupH + BAR.group);
    return {
      top,
      height: groupH,
      labelY: top + BAR.label - 4,
      bars: row.map((v, j) => {
        const y = top + BAR.label + j * (BAR.height + BAR.gap);
        const width = round((v / max) * span);
        return { y, width, textX: PAD + width + 4, textY: y + BAR.height - 1 };
      }),
    };
  });
  return { width: CHART_WIDTH, height: 2 * PAD + Math.max(0, values.length * (groupH + BAR.group) - BAR.group), left: PAD, rows };
}

const LINE = { height: 180, left: 36, right: 10, top: 10, bottom: 24 } as const;
export type Point = { x: number; y: number };
export type LineLayout = { width: number; height: number; left: number; right: number; top: number; baseline: number; step: number; x: number[]; ticks: { value: number; y: number }[]; lines: Point[][] };

/** Lines over a shared category axis; y runs from zero to the largest value, with a tick at each end. */
export function lineLayout(series: readonly (readonly number[])[]): LineLayout {
  const n = Math.max(0, ...series.map((s) => s.length));
  const max = Math.max(1, ...series.flat());
  const plotW = CHART_WIDTH - LINE.left - LINE.right;
  const plotH = LINE.height - LINE.top - LINE.bottom;
  const step = n > 1 ? plotW / (n - 1) : 0;
  const yOf = (v: number) => round(LINE.top + plotH - (v / max) * plotH);
  const x = Array.from({ length: n }, (_, i) => round(LINE.left + i * step));
  return {
    width: CHART_WIDTH,
    height: LINE.height,
    left: LINE.left,
    right: CHART_WIDTH - LINE.right,
    top: LINE.top,
    baseline: LINE.top + plotH,
    step,
    x,
    ticks: [{ value: 0, y: yOf(0) }, { value: max, y: yOf(max) }],
    lines: series.map((s) => s.map((v, i) => ({ x: x[i]!, y: yOf(v) }))),
  };
}
export const linePoints = (pts: readonly Point[]): string => pts.map((p) => `${p.x},${p.y}`).join(" ");
