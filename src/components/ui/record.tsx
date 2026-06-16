/**
 * Editorial record primitives — flat, border-defined sections for detail and
 * form pages (no boxed cards). Mono-uppercase eyebrow with a cyan accent rule,
 * and definition rows that fall back to an em-dash.
 */

export function SectionRule({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-2 border-b border-edge-soft pb-2">
      <span className="h-px w-4 bg-brand-accent" aria-hidden="true" />
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
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
      <dt className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-soft">
        {label}
      </dt>
      <dd className="mt-1 text-[13px] text-ink">
        {value === null || value === undefined || value === "" ? "—" : value}
      </dd>
    </div>
  );
}
