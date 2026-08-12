"use client";

import { cloneElement, isValidElement, useId } from "react";

/**
 * A labelled form row.
 *
 * The label is tied to its control even when the caller passes no `htmlFor`:
 * a single child element gets a generated `id`, which is what `<label for>`
 * points at. Before this, every field in the leg and cargo editors rendered a
 * label associated with nothing — invisible to screen readers, and unreachable
 * by `getByLabel` in tests. Doing it here fixes all of them at once instead of
 * threading unique ids through two hundred call sites.
 *
 * Children that are not a single element (an input plus a hint, say) keep the
 * old behaviour, so those callers still pass `htmlFor` themselves.
 */
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
  const generated = useId();
  const only = isValidElement<{ id?: string }>(children) ? children : null;
  const childId = only?.props.id;
  const id = htmlFor ?? childId ?? (only ? generated : undefined);
  // Custom components that ignore `id` simply stay as they were.
  const control = only && !childId && id ? cloneElement(only, { id }) : children;

  return (
    <div className={`mb-4 ${className}`}>
      {/* Sentence case, not the uppercase micro label: a long form has forty of
          these, and shouting forty times is not emphasis. */}
      <label htmlFor={id} className="mb-1.5 block text-[12px] font-medium text-ink-soft">
        {label}
      </label>
      {control}
      {error && error.length > 0 && (
        <p className="mt-1 text-[11.5px] text-[rgb(var(--danger-fg))]">{error[0]}</p>
      )}
    </div>
  );
}
