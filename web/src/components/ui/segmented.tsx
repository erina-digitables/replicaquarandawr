"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type SegmentOption<T extends string> = { value: T; label: string; icon?: ReactNode };

/** In-page tabs (role=tablist) with roving tabindex. Route-level nav should use links instead. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  variant = "track",
  className,
}: {
  label: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  variant?: "track" | "underline";
  className?: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKey(e: KeyboardEvent, i: number) {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    const jump = e.key === "Home" ? 0 : e.key === "End" ? options.length - 1 : null;
    if (!step && jump === null) return;
    e.preventDefault();
    const next = jump ?? (i + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        "flex",
        variant === "track" ? "gap-1 rounded-lg border border-border bg-surface-2 p-1" : "border-b border-border",
        className,
      )}
    >
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            type="button"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "flex min-h-11 flex-1 items-center justify-center gap-2 px-3 text-sm font-bold transition-colors duration-(--t-duration-fast) [&_svg]:size-4",
              variant === "track" &&
                (selected
                  ? "rounded-md border border-border bg-surface text-text shadow-card"
                  : "rounded-md border border-transparent text-text-muted hover:text-text"),
              variant === "underline" &&
                (selected ? "-mb-px border-b-2 border-accent text-text" : "text-text-muted hover:text-text"),
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
