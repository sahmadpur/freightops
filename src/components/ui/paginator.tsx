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
    <div className="mt-4 flex items-center justify-between font-mono text-[11px] text-ink-soft">
      <span>
        {Math.min((page - 1) * PAGE_SIZE + 1, total)}–{Math.min(page * PAGE_SIZE, total)} / {total}
      </span>
      <div className="flex gap-1">
        {page > 1 && (
          <Link
            href={href(page - 1)}
            className="rounded-full border border-edge-chip px-3 py-1 transition-colors hover:border-brand hover:bg-brand hover:text-brand-pale"
          >
            ‹
          </Link>
        )}
        <span className="rounded-full border border-brand bg-brand px-3 py-1 font-medium text-brand-pale">
          {page}
        </span>
        {page < pages && (
          <Link
            href={href(page + 1)}
            className="rounded-full border border-edge-chip px-3 py-1 transition-colors hover:border-brand hover:bg-brand hover:text-brand-pale"
          >
            ›
          </Link>
        )}
      </div>
    </div>
  );
}
