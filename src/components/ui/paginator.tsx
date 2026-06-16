import Link from "next/link";

export const PAGE_SIZE = 20;

export function Paginator({
  page,
  total,
  basePath,
  params = {},
}: {
  page: number;
  total: number;
  basePath: string;
  params?: Record<string, string>;
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages === 1) return null;

  const href = (p: number) => {
    const q = new URLSearchParams({ ...params, page: String(p) });
    return `${basePath}?${q.toString()}`;
  };

  return (
    <div className="mt-3 flex items-center justify-between font-mono text-[11px] tracking-[0.04em] text-ink-soft">
      <span>
        {Math.min((page - 1) * PAGE_SIZE + 1, total)}–{Math.min(page * PAGE_SIZE, total)} / {total}
      </span>
      <div className="flex gap-1">
        {page > 1 && (
          <Link
            href={href(page - 1)}
            className="rounded-[5px] border border-edge-chip px-2.5 py-1 transition-colors hover:bg-surface-chip-active hover:text-brand"
          >
            ‹
          </Link>
        )}
        <span className="rounded-[5px] border border-brand bg-brand px-2.5 py-1 font-medium text-brand-pale">
          {page}
        </span>
        {page < pages && (
          <Link
            href={href(page + 1)}
            className="rounded-[5px] border border-edge-chip px-2.5 py-1 transition-colors hover:bg-surface-chip-active hover:text-brand"
          >
            ›
          </Link>
        )}
      </div>
    </div>
  );
}
