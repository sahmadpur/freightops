import { StatusBadge } from "@/components/ui/status-badge";

/** Same hue coding as `StatusBadge`, one step more saturated for the bar. */
const SEGMENT_COLORS: Record<string, string> = {
  created: "#91afff",
  waiting_pickup: "#c3cad6",
  received: "#a99cf0",
  internal_transit: "#7dc4e3",
  loaded: "#6cc9a5",
  transit: "#f5c344",
  at_border: "#f0a37a",
  at_customs: "#e78fb1",
  arrived: "#a8cf72",
  delivered: "#22a06b",
  closed: "#c4c4c4",
};

export function StatusBar({ counts }: { counts: { status: string; count: number }[] }) {
  const total = counts.reduce((s, c) => s + c.count, 0);
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full">
        {total === 0 ? (
          <div className="h-full w-full bg-slate-100" />
        ) : (
          counts
            .filter((c) => c.count > 0)
            .map((c) => (
              <div
                key={c.status}
                style={{ width: `${(c.count / total) * 100}%`, background: SEGMENT_COLORS[c.status] ?? "#ccc" }}
                title={`${c.status}: ${c.count}`}
              />
            ))
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        {counts.filter((c) => c.count > 0).map((c) => (
          <span key={c.status} className="flex items-center gap-1.5 text-xs">
            <StatusBadge status={c.status} /> {c.count}
          </span>
        ))}
      </div>
    </div>
  );
}
