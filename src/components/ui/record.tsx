/**
 * Record primitives — flat, border-defined sections for detail and form pages
 * (no boxed cards). A section rule is a hairline with an uppercase micro label
 * sitting on it; the definition rows fall back to an em-dash.
 */

export function SectionRule({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-3 border-b border-edge-chip pb-2.5">
      <span className="eyebrow text-ink">{children}</span>
    </div>
  );
}

export function DefRow({
  label,
  value,
  className = "",
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-[11px] font-medium text-ink-faint">{label}</dt>
      <dd className="mt-1 font-display text-[13px] font-semibold tracking-[-0.01em] text-ink">
        {value === null || value === undefined || value === "" ? "—" : value}
      </dd>
    </div>
  );
}
