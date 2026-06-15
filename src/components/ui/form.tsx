export const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20";

export function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3.5">
      <label
        htmlFor={htmlFor}
        className="mb-1 block text-sm font-semibold text-slate-700"
      >
        {label}
      </label>
      {children}
      {error && error.length > 0 && <p className="mt-1 text-xs text-red-700">{error[0]}</p>}
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
