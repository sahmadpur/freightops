export function Card({
  children,
  className = "",
  interactive = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** Lift + deepen the shadow on hover. Use for clickable cards, not dense grids. */
  interactive?: boolean;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-slate-100 bg-white shadow-soft ${
        interactive
          ? "transition-all duration-200 hover:-translate-y-1 hover:shadow-soft-lg"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
      {children}
    </div>
  );
}

export function CardBody({ children }: { children: React.ReactNode }) {
  return <div className="p-4">{children}</div>;
}
