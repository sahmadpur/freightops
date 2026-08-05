export function Card({
  children,
  className = "",
  interactive = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** Tint the border blue + lift the surface on hover. Use for clickable cards. */
  interactive?: boolean;
}) {
  return (
    <div
      className={`overflow-hidden rounded-[14px] border border-edge-soft bg-surface-card shadow-[0_1px_1px_rgba(0,0,0,0.04)] ${
        interactive
          ? "transition-colors hover:border-brand-light hover:bg-surface-hover"
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
