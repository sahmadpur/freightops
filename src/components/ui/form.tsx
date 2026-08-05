export const inputCls =
  "w-full rounded-[10px] border border-edge-chip bg-surface-card px-3 py-2 text-[13px] text-ink outline-none transition-colors placeholder:text-ink-soft/55 focus:border-edge-focus focus:ring-2 focus:ring-brand/15";

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
        className="mb-1.5 block text-[12px] font-medium text-ink-soft"
      >
        {label}
      </label>
      {children}
      {error && error.length > 0 && (
        <p className="mt-1 text-[11.5px] text-[rgb(var(--danger-fg))]">
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
