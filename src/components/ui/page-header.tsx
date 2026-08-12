export function PageHeader({
  title,
  eyebrow,
  action,
}: {
  title: React.ReactNode;
  /** Optional micro label above the title (e.g. the parent section). */
  eyebrow?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-edge-soft pb-5">
      <div>
        {eyebrow && (
          <div className="mb-2.5">
            <span className="eyebrow">{eyebrow}</span>
          </div>
        )}
        <h1 className="font-display text-[30px] font-extrabold leading-[1.05] tracking-[-0.04em] text-brand-deep">
          {title}
        </h1>
      </div>
      {action}
    </div>
  );
}
