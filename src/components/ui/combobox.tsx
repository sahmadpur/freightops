"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { inputCls } from "./form";

export type ComboOption = {
  value: string;
  label: string;
  /** Rendered before the label — a flag emoji, a code, a swatch. */
  prefix?: string;
};

/** Cap on rendered rows so a 250-country list stays cheap; typing narrows it. */
const MAX_VISIBLE = 100;

function matches(option: ComboOption, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return option.label.toLowerCase().includes(q) || option.value.toLowerCase().includes(q);
}

const listCls =
  "absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-[10px] border border-edge-chip bg-surface-card py-1 shadow-lg";

const optionCls = (active: boolean, selected: boolean) =>
  `flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] ${
    active ? "bg-surface-hover" : ""
  } ${selected ? "font-medium text-brand" : "text-ink"}`;

/**
 * Shared open/filter/keyboard plumbing for both combobox flavours. Owns the
 * query so every change that reshuffles the list also resets the highlighted
 * row in the same update, instead of correcting it afterwards in an effect.
 */
function useCombo(options: ComboOption[]) {
  const [open, setOpenState] = useState(false);
  const [query, setQueryState] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => options.filter((o) => matches(o, query)).slice(0, MAX_VISIBLE),
    [options, query],
  );

  // Clicking outside closes the list. Pointerdown (not click) so it also fires
  // when the press starts on another form control.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpenState(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const setQuery = (next: string) => {
    setQueryState(next);
    setActive(0);
  };
  const setOpen = (next: boolean) => {
    setOpenState(next);
    setActive(0);
  };

  return { open, setOpen, query, setQuery, active, setActive, filtered, rootRef };
}

export function Combobox({
  id,
  value,
  onChange,
  options,
  placeholder = "",
  emptyLabel = "—",
  disabled = false,
  clearable = true,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: ComboOption[];
  placeholder?: string;
  /** Text shown in the empty-results row. */
  emptyLabel?: string;
  disabled?: boolean;
  clearable?: boolean;
}) {
  const { open, setOpen, query, setQuery, active, setActive, filtered, rootRef } =
    useCombo(options);
  const listId = useId();
  const selected = options.find((o) => o.value === value) ?? null;

  const pick = (option: ComboOption) => {
    onChange(option.value);
    setQuery("");
    setOpen(false);
  };

  const display = open ? query : selected ? `${selected.prefix ? `${selected.prefix} ` : ""}${selected.label}` : "";

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return setOpen(true);
      const delta = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (filtered.length === 0 ? 0 : (i + delta + filtered.length) % filtered.length));
    } else if (e.key === "Enter") {
      if (open && filtered[active]) {
        e.preventDefault();
        pick(filtered[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && filtered[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        disabled={disabled}
        className={`${inputCls} ${clearable && selected ? "pr-8" : ""}`}
        placeholder={placeholder}
        value={display}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {clearable && selected && !open && (
        <button
          type="button"
          aria-label="Clear"
          className="absolute right-2 top-1/2 -translate-y-1/2 px-1 text-ink-soft hover:text-ink"
          onClick={() => onChange("")}
        >
          ×
        </button>
      )}
      {open && (
        <ul id={listId} role="listbox" className={listCls}>
          {filtered.length === 0 ? (
            <li className="px-3 py-1.5 text-[13px] text-ink-soft">{emptyLabel}</li>
          ) : (
            filtered.map((o, i) => (
              <li
                key={o.value}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={o.value === value}
                className={optionCls(i === active, o.value === value)}
                onMouseEnter={() => setActive(i)}
                // Commit on mousedown: blur would otherwise close the list first.
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(o);
                }}
              >
                {o.prefix && <span aria-hidden="true">{o.prefix}</span>}
                <span>{o.label}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export function MultiCombobox({
  id,
  values,
  onChange,
  options,
  placeholder = "",
  emptyLabel = "—",
  /** Allow committing whatever was typed, for open-ended lists like cargo. */
  creatable = false,
  disabled = false,
}: {
  id?: string;
  values: string[];
  onChange: (values: string[]) => void;
  options: ComboOption[];
  placeholder?: string;
  emptyLabel?: string;
  creatable?: boolean;
  disabled?: boolean;
}) {
  const { open, setOpen, query, setQuery, active, setActive, filtered, rootRef } =
    useCombo(options);
  const listId = useId();

  const toggle = (value: string) => {
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
    setQuery("");
  };

  const commitTyped = () => {
    const raw = query.trim();
    if (!raw || values.includes(raw)) return;
    onChange([...values, raw]);
    setQuery("");
  };

  const labelFor = (value: string) => options.find((o) => o.value === value)?.label ?? value;

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return setOpen(true);
      const delta = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (filtered.length === 0 ? 0 : (i + delta + filtered.length) % filtered.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && filtered[active]) toggle(filtered[active].value);
      else if (creatable) commitTyped();
    } else if (e.key === "Backspace" && !query && values.length > 0) {
      onChange(values.slice(0, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <div
        className={`${inputCls} flex flex-wrap items-center gap-1.5 ${disabled ? "opacity-60" : ""}`}
        onClick={() => !disabled && setOpen(true)}
      >
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded-full bg-surface-chip-active px-2 py-0.5 text-[11px] text-ink"
          >
            {labelFor(v)}
            <button
              type="button"
              aria-label={`Remove ${labelFor(v)}`}
              className="text-ink-soft hover:text-ink"
              onClick={(e) => {
                e.stopPropagation();
                onChange(values.filter((x) => x !== v));
              }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && filtered[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          disabled={disabled}
          className="min-w-[8ch] flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-soft/55"
          placeholder={values.length === 0 ? placeholder : ""}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => creatable && commitTyped()}
        />
      </div>
      {open && (
        <ul id={listId} role="listbox" aria-multiselectable className={listCls}>
          {filtered.length === 0 ? (
            <li className="px-3 py-1.5 text-[13px] text-ink-soft">
              {creatable && query.trim() ? query.trim() : emptyLabel}
            </li>
          ) : (
            filtered.map((o, i) => (
              <li
                key={o.value}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={values.includes(o.value)}
                className={optionCls(i === active, values.includes(o.value))}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  toggle(o.value);
                }}
              >
                {o.prefix && <span aria-hidden="true">{o.prefix}</span>}
                <span>{o.label}</span>
                {values.includes(o.value) && <span className="ml-auto text-brand">✓</span>}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
