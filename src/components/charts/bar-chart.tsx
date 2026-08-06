/**
 * Grouped vertical bars — the finance page's trend primitive. Server-rendered
 * inline SVG, no charting dependency and no client JS: hover values come from
 * per-bar <title> elements, and the precise numbers live in the table each
 * caller renders beside the chart (which is also the screen-reader view).
 *
 * One value axis only, always anchored at zero, so negative months (a loss)
 * read as bars below the baseline. Series colors are the `--chart-*` tokens in
 * fixed order, so they follow the light/dark flip and never get cycled.
 */
export type ChartSeries = {
  key: string;
  label: string;
  /** 1-based index into the --chart-* tokens. */
  tone: 1 | 2 | 3;
};

export type ChartPoint = { category: string; values: Record<string, number> };

const W = 720;
const H = 260;
const PAD = { top: 12, right: 10, bottom: 28, left: 66 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;
const BAR_GAP = 2; // the surface-colored sliver between adjacent bars

export function BarChart({
  points,
  series,
  format,
  ariaLabel,
  empty,
}: {
  points: ChartPoint[];
  series: ChartSeries[];
  /** Full value formatter, used for the y-axis ticks and hover titles. */
  format: (cents: number) => string;
  ariaLabel: string;
  empty: string;
}) {
  if (points.length === 0) return <p className="text-sm text-ink-soft">{empty}</p>;

  const values = points.flatMap((p) => series.map((s) => p.values[s.key] ?? 0));
  const ticks = axisTicks(Math.min(0, ...values), Math.max(0, ...values));
  const min = ticks[0];
  const max = ticks[ticks.length - 1];
  const y = (v: number) => PAD.top + PLOT_H - ((v - min) / (max - min)) * PLOT_H;
  const zero = y(0);

  const groupW = PLOT_W / points.length;
  const barW = Math.max(3, (groupW * 0.62) / series.length - BAR_GAP);

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={ariaLabel}
      >
        {/* Recessive gridlines + value axis */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(t)}
              y2={y(t)}
              stroke={`rgb(var(--edge-soft))`}
              strokeWidth={t === 0 ? 1.5 : 1}
            />
            <text
              x={PAD.left - 8}
              y={y(t) + 3.5}
              textAnchor="end"
              fontSize="10"
              fill="rgb(var(--ink-soft))"
            >
              {compact(t)}
            </text>
          </g>
        ))}

        {points.map((p, i) => {
          const groupX = PAD.left + i * groupW;
          const barsW = series.length * barW + (series.length - 1) * BAR_GAP;
          return (
            <g key={p.category}>
              {series.map((s, j) => {
                const v = p.values[s.key] ?? 0;
                const top = Math.min(y(v), zero);
                const height = Math.max(1, Math.abs(zero - y(v)));
                return (
                  <rect
                    key={s.key}
                    x={groupX + (groupW - barsW) / 2 + j * (barW + BAR_GAP)}
                    y={top}
                    width={barW}
                    height={height}
                    rx={Math.min(3, barW / 2)}
                    fill={`rgb(var(--chart-${s.tone}))`}
                  >
                    <title>{`${p.category} · ${s.label}: ${format(v)}`}</title>
                  </rect>
                );
              })}
              <text
                x={groupX + groupW / 2}
                y={H - 9}
                textAnchor="middle"
                fontSize="10"
                fill="rgb(var(--ink-soft))"
              >
                {p.category}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Identity is never color-alone: the legend names every series. */}
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-[11.5px] text-ink-soft">
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: `rgb(var(--chart-${s.tone}))` }}
            />
            {s.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

/** Five gridline values spanning [min, max], rounded to a readable step. */
export function axisTicks(min: number, max: number): number[] {
  if (max === min) return [0, 1];
  const rawStep = (max - min) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rawStep)!;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v));
  return out;
}

/** Axis ticks are cents: shorten them (₼1.2M) so the labels stay out of the way. */
function compact(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(cents / 100);
}
