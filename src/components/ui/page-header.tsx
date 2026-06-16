export function PageHeader({
  title,
  eyebrow,
  action,
}: {
  title: React.ReactNode;
  /** Optional mono label stamped above the title (e.g. a section code). */
  eyebrow?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <div className="mb-1.5 flex items-center gap-2">
            <span className="h-px w-4 bg-brand-accent" aria-hidden="true" />
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
              {eyebrow}
            </span>
          </div>
        )}
        <h1 className="font-display text-[26px] font-medium leading-[1.05] tracking-[-0.01em] text-brand-deep">
          {title}
        </h1>
      </div>
      {action}
    </div>
  );
}
