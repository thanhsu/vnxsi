import type { FC } from "hono/jsx";

/** Stroke icons, one set (audit §2.7). Decorative: the text next to them carries the meaning. */
export const Icon: FC<{ d: readonly string[]; size?: number; width?: number; circles?: readonly (readonly [number, number, number])[]; rects?: readonly (readonly [number, number, number, number, number])[] }> = ({
  d,
  size = 22,
  width = 1.6,
  circles = [],
  rects = [],
}) => (
  <svg class="icon" viewBox="0 0 24 24" width={size} height={size} stroke-width={width} aria-hidden="true" focusable="false">
    {rects.map(([x, y, w, h, r]) => (
      <rect x={x} y={y} width={w} height={h} rx={r} />
    ))}
    {circles.map(([cx, cy, r]) => (
      <circle cx={cx} cy={cy} r={r} />
    ))}
    {d.map((path) => (
      <path d={path} />
    ))}
  </svg>
);

export const CHECK = ["M5 12l5 5L20 7"];
