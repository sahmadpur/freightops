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
    <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
      <span>
        {Math.min((page - 1) * PAGE_SIZE + 1, total)}–{Math.min(page * PAGE_SIZE, total)} / {total}
      </span>
      <div className="flex gap-1">
        {page > 1 && (
          <Link href={href(page - 1)} className="rounded-md border border-slate-200 px-2.5 py-1 hover:bg-slate-50">
            ‹
          </Link>
        )}
        <span className="rounded-md bg-[#1a3a5c] px-2.5 py-1 text-white">{page}</span>
        {page < pages && (
          <Link href={href(page + 1)} className="rounded-md border border-slate-200 px-2.5 py-1 hover:bg-slate-50">
            ›
          </Link>
        )}
      </div>
    </div>
  );
}
