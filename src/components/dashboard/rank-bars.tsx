/**
 * A small horizontal bar list — the dashboard's breakdown primitive (orders by
 * transport type, top routes, top clients). Pure markup in the same visual
 * register as `status-bar.tsx`; no charting dependency.
 */
export function RankBars({
  rows,
  empty,
}: {
  rows: { key: string; label: React.ReactNode; value: number; caption?: string }[];
  empty: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-ink-soft">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[12.5px]">
            <span className="min-w-0 truncate">{r.label}</span>
            <span className="shrink-0 tabular-nums text-ink-soft">{r.caption ?? r.value}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
            <div
              className="h-full rounded-full bg-brand-accent"
              style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
