"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useIsMobile } from "@/lib/use-is-mobile";

export type Column<T> = {
  key: string;
  header: ReactNode;
  /** Initial width, e.g. "120px". Omit for free-flowing columns that absorb slack. */
  width?: string;
  align?: "left" | "center" | "right";
  /** Dropped below 768px. */
  hiddenOnMobile?: boolean;
  render: (row: T) => ReactNode;
};

const ALIGN: Record<NonNullable<Column<unknown>["align"]>, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

/**
 * Editorial data table (DESIGN_SYSTEM §6/§13). Columns drag-to-resize from the
 * right edge of each header; widths persist to localStorage per `storageKey`.
 * `hiddenOnMobile` columns drop below 768px. Resize is mouse-only and disabled
 * on touch/mobile.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  minWidth = 900,
  storageKey,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
  minWidth?: number;
  storageKey?: string;
}) {
  const isMobile = useIsMobile(768);
  const cols = isMobile ? columns.filter((c) => !c.hiddenOnMobile) : columns;
  const resizable = Boolean(storageKey) && !isMobile;

  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [dragKey, setDragKey] = useState<string | null>(null);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const thRefs = useRef<Record<string, HTMLTableCellElement | null>>({});
  const hydratedRef = useRef(false);

  // Hydrate persisted widths once on mount.
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(`dt-cols-${storageKey}`);
      // Hydrate client-only persisted widths after mount. A lazy useState
      // initializer can't be used here — localStorage is unavailable during SSR
      // and would cause a hydration mismatch.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setColWidths(JSON.parse(raw));
    } catch {
      /* ignore quota / parse errors */
    }
    hydratedRef.current = true;
  }, [storageKey]);

  // Debounced persist (skip the initial empty write before hydration).
  useEffect(() => {
    if (!storageKey || !hydratedRef.current) return;
    const id = setTimeout(() => {
      try {
        localStorage.setItem(`dt-cols-${storageKey}`, JSON.stringify(colWidths));
      } catch {
        /* ignore */
      }
    }, 300);
    return () => clearTimeout(id);
  }, [colWidths, storageKey]);

  // While a column is being dragged, track the mouse on the window and write
  // widths; listeners are attached only for the duration of the drag.
  useEffect(() => {
    if (!dragKey) return;
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const next = Math.max(40, d.startWidth + (e.clientX - d.startX));
      setColWidths((w) => ({ ...w, [dragKey]: next }));
    };
    const onUp = () => {
      dragRef.current = null;
      setDragKey(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragKey]);

  function startDrag(e: React.MouseEvent, key: string) {
    e.preventDefault();
    const measured = thRefs.current[key]?.getBoundingClientRect().width ?? 120;
    dragRef.current = { startX: e.clientX, startWidth: colWidths[key] ?? measured };
    setDragKey(key);
  }

  const widthFor = (c: Column<T>) =>
    colWidths[c.key] != null ? `${colWidths[c.key]}px` : c.width;

  return (
    <div className="overflow-x-auto rounded-[10px] border border-edge-soft bg-surface-card">
      <table
        className="w-full border-collapse"
        style={{ tableLayout: "fixed", minWidth }}
      >
        <thead className="bg-surface-thead">
          <tr>
            {cols.map((c) => (
              <th
                key={c.key}
                ref={(el) => {
                  thRefs.current[c.key] = el;
                }}
                style={{ width: widthFor(c) }}
                className={`group relative border-b border-edge-chip px-3 py-2.5 text-[11px] font-semibold leading-tight text-brand-deep ${ALIGN[c.align ?? "left"]}`}
              >
                {c.header}
                {resizable && (
                  <span
                    onMouseDown={(e) => startDrag(e, c.key)}
                    className={`absolute right-0 top-0 h-full w-[4px] cursor-col-resize select-none transition-opacity motion-reduce:transition-none hover:bg-edge-chip ${
                      dragKey === c.key
                        ? "bg-brand/40 opacity-100"
                        : "opacity-0 group-hover:opacity-100"
                    }`}
                  />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={cols.length}
                className="py-12 text-center text-sm text-ink-soft"
              >
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)} className="hover:bg-surface-hover">
                {cols.map((c) => (
                  <td
                    key={c.key}
                    style={{ width: widthFor(c) }}
                    className={`border-b border-edge-soft px-3 py-2.5 align-middle text-[12.5px] text-ink ${ALIGN[c.align ?? "left"]}`}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
