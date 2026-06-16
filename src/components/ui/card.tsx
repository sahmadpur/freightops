export function Card({
  children,
  className = "",
  interactive = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** Warm the border + lift the surface on hover. Use for clickable cards. */
  interactive?: boolean;
}) {
  return (
    <div
      className={`overflow-hidden rounded-[10px] border border-edge-soft bg-surface-card ${
        interactive
          ? "transition-colors hover:border-edge-chip hover:bg-surface-hover"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-edge-soft px-4 py-2.5">
      {children}
    </div>
  );
}

export function CardBody({ children }: { children: React.ReactNode }) {
  return <div className="p-4">{children}</div>;
}
