export function Card({
  children,
  className = "",
  interactive = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** Darken the border on hover. Use for clickable cards. */
  interactive?: boolean;
}) {
  return (
    <div
      className={`overflow-hidden rounded-card border border-edge-soft bg-surface-card ${
        interactive ? "transition-colors hover:border-brand" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-edge-soft px-4 py-3">
      {children}
    </div>
  );
}

export function CardBody({ children }: { children: React.ReactNode }) {
  return <div className="p-4">{children}</div>;
}
