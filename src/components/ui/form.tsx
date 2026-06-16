export const inputCls =
  "w-full rounded-[5px] border border-edge-chip bg-surface-hover px-3 py-2 text-[13px] text-ink outline-none transition-colors placeholder:text-ink-soft/55 focus:border-edge-focus";

export function Field({
  label,
  htmlFor,
  error,
  children,
  className = "",
}: {
  label: string;
  htmlFor?: string;
  error?: string[];
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-3.5 ${className}`}>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-soft"
      >
        {label}
      </label>
      {children}
      {error && error.length > 0 && (
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.06em] text-[rgb(var(--danger-fg))]">
          {error[0]}
        </p>
      )}
    </div>
  );
}

export function SubmitRow({
  pending,
  saveLabel,
  cancelHref,
  cancelLabel,
}: {
  pending: boolean;
  saveLabel: string;
  cancelHref: string;
  cancelLabel: string;
}) {
  return (
    <div className="mt-4 flex justify-end gap-2">
      <a href={cancelHref} className="btn-secondary">
        {cancelLabel}
      </a>
      <button type="submit" disabled={pending} className="btn-primary">
        {saveLabel}
      </button>
    </div>
  );
}
