/**
 * Record primitives — flat, border-defined sections for detail and form pages
 * (no boxed cards). A section rule carries a blue dot and a Geist label; the
 * definition rows fall back to an em-dash.
 */

export function SectionRule({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-2 border-b border-edge-soft pb-2">
      <span className="h-[5px] w-[5px] rounded-full bg-brand" aria-hidden="true" />
      <span className="font-display text-[13px] font-medium tracking-[-0.01em] text-brand-deep">
        {children}
      </span>
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
      <dt className="text-[11.5px] font-medium text-ink-soft">
        {label}
      </dt>
      <dd className="mt-1 text-[13px] text-ink">
        {value === null || value === undefined || value === "" ? "—" : value}
      </dd>
    </div>
  );
}
