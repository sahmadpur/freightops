import { StatusBadge } from "@/components/ui/status-badge";

const SEGMENT_COLORS: Record<string, string> = {
  created: "#b5d4f4",
  received: "#c5bdf0",
  internal_transit: "#a8d8ed",
  loaded: "#9fe1cb",
  transit: "#fac775",
  at_border: "#f5c4b3",
  at_customs: "#f4c0d1",
  arrived: "#c0dd97",
  delivered: "#5dcaa5",
  closed: "#c4c4c4",
};

export function StatusBar({ counts }: { counts: { status: string; count: number }[] }) {
  const total = counts.reduce((s, c) => s + c.count, 0);
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded">
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
