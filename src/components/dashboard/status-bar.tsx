import { StatusBadge } from "@/components/ui/status-badge";
import { statusHue } from "@/lib/status-hue";

/**
 * Same stage hues as `StatusBadge` (the `--status-*` tokens), lightened one
 * step against the card so a 10px bar reads without shouting.
 */
const segment = (status: string) =>
  `color-mix(in oklab, rgb(${statusHue(status)}) 65%, rgb(var(--surface-card)))`;

export function StatusBar({ counts }: { counts: { status: string; count: number }[] }) {
  const total = counts.reduce((s, c) => s + c.count, 0);
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full">
        {total === 0 ? (
          <div className="h-full w-full bg-edge-soft" />
        ) : (
          counts
            .filter((c) => c.count > 0)
            .map((c) => (
              <div
                key={c.status}
                style={{ width: `${(c.count / total) * 100}%`, background: segment(c.status) }}
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
