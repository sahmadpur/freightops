// Field lives in its own client module (it uses useId); re-exported here so the
// twenty-odd call sites keep importing it from "@/components/ui/form".
export { Field } from "./field";

export const inputCls =
  "w-full rounded-control border border-edge-chip bg-transparent px-3 py-2 text-[13px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand";

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
