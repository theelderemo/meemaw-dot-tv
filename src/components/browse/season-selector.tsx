"use client";

import { useEffect, useRef, useState } from "react";
import type { SeasonSummary } from "@/lib/tmdb/schemas";

// The season dropdown: dark bordered button with a caret, opening a
// right-aligned dark menu of seasons with episode counts. Single-season
// titles get a static label instead of a one-item menu.
export default function SeasonSelector({
  options,
  value,
  onChange,
}: {
  options: SeasonSummary[];
  value: number;
  onChange: (seasonNumber: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const selected = options.find((option) => option.seasonNumber === value);
  const selectedName = selected?.name ?? `Season ${value}`;

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("click", closeOnOutsideClick);
    return () => document.removeEventListener("click", closeOnOutsideClick);
  }, [open]);

  // Capture-phase Escape closes just the menu: stopPropagation here keeps the
  // modal's bubble-phase Escape listener from also closing the dialog.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open]);

  if (options.length <= 1) {
    return <span className="text-lg font-medium">{selectedName}</span>;
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className="flex cursor-pointer items-center gap-3 rounded border border-neutral-600 bg-neutral-800 px-4 py-1.5 text-lg font-medium transition-colors hover:bg-neutral-700"
      >
        {selectedName}
        <span
          aria-hidden="true"
          className={`border-x-6 border-t-8 border-x-transparent border-t-white transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label="Season"
          className="absolute top-full right-0 z-10 mt-1 max-h-72 min-w-full overflow-y-auto rounded border border-neutral-600 bg-neutral-800 py-1 shadow-xl"
        >
          {options.map((option) => (
            <li key={option.seasonNumber} role="none">
              <button
                type="button"
                role="option"
                aria-selected={option.seasonNumber === value}
                onClick={() => {
                  onChange(option.seasonNumber);
                  setOpen(false);
                }}
                className={`flex w-full cursor-pointer items-baseline justify-between gap-6 px-4 py-2 text-left whitespace-nowrap transition-colors hover:bg-white/10 ${
                  option.seasonNumber === value ? "font-bold" : ""
                }`}
              >
                {option.name}
                {option.episodeCount > 0 && (
                  <span className="text-muted text-sm">
                    {option.episodeCount} Episodes
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
