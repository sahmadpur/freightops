export function PageHeader({
  title,
  eyebrow,
  action,
}: {
  title: React.ReactNode;
  /** Optional pill label above the title (e.g. the parent section). */
  eyebrow?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        {eyebrow && <div className="mb-2"><span className="eyebrow">{eyebrow}</span></div>}
        <h1 className="font-display text-[27px] font-medium leading-[1.1] tracking-[-0.03em] text-brand-deep">
          {title}
        </h1>
      </div>
      {action}
    </div>
  );
}
