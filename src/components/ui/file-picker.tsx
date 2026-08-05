"use client";

import { useRef } from "react";
import { ALLOWED_TYPES, MAX_FILE_BYTES, validateUpload } from "@/lib/upload";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Buffers a multi-file selection client-side so a form can upload after the
 * parent record exists (order create) or in one go (order view). Rejects
 * oversized / disallowed files up front using the same rules the server
 * re-applies in `validateUpload`.
 */
export function FilePicker({
  id,
  files,
  onChange,
  addLabel,
  emptyLabel,
  removeLabel,
  errorLabels,
  onReject,
  disabled = false,
}: {
  id?: string;
  files: File[];
  onChange: (files: File[]) => void;
  addLabel: string;
  emptyLabel: string;
  removeLabel: string;
  errorLabels: { tooLarge: string; badType: string; emptyFile: string };
  /** Called with a localized message when a picked file is rejected. */
  onReject?: (message: string) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function add(picked: FileList | null) {
    if (!picked) return;
    const accepted: File[] = [];
    for (const file of Array.from(picked)) {
      const check = validateUpload(file);
      if (!check.ok) {
        const message =
          check.reason === "too_large"
            ? errorLabels.tooLarge
            : check.reason === "type"
              ? errorLabels.badType
              : errorLabels.emptyFile;
        onReject?.(`${file.name}: ${message}`);
        continue;
      }
      // Same name + size + mtime twice is a re-pick, not a second document.
      const duplicate = files.some(
        (f) => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified,
      );
      if (!duplicate) accepted.push(file);
    }
    if (accepted.length) onChange([...files, ...accepted]);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <input
        id={id}
        ref={inputRef}
        type="file"
        multiple
        disabled={disabled}
        accept={ALLOWED_TYPES.join(",")}
        className="hidden"
        onChange={(e) => add(e.target.files)}
      />
      <button
        type="button"
        disabled={disabled}
        className="btn-secondary"
        onClick={() => inputRef.current?.click()}
      >
        {addLabel}
      </button>
      <span className="ml-3 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-soft">
        {formatSize(MAX_FILE_BYTES)} max
      </span>
      {files.length === 0 ? (
        <p className="mt-2 text-[12px] text-ink-soft">{emptyLabel}</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${f.size}-${f.lastModified}`}
              className="flex items-center justify-between gap-3 border-b border-edge-soft pb-1 text-[13px] last:border-0"
            >
              <span className="min-w-0 truncate">{f.name}</span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="font-mono text-[10px] text-ink-soft">{formatSize(f.size)}</span>
                <button
                  type="button"
                  disabled={disabled}
                  className="text-ink-soft hover:text-[rgb(var(--danger-fg))]"
                  onClick={() => onChange(files.filter((_, j) => j !== i))}
                >
                  {removeLabel}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
