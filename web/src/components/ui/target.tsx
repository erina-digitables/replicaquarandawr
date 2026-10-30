"use client";

import { ChevronDown, Minus, Plus } from "lucide-react";
import { useId, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { IconButton } from "./button";

const QUARTERS_PER_JUZ = 8;

export function juzLabel(quarters: number) {
  const juz = quarters / QUARTERS_PER_JUZ;
  if (juz === 0.125) return "an eighth of a juz";
  if (juz === 0.25) return "a quarter of a juz";
  if (juz === 0.5) return "half a juz";
  if (juz === 1) return "1 juz";
  return `${+juz.toFixed(2)} juz`;
}

export function TargetStepper({ value, onChange, min = 1, max = 240 }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  const set = (n: number) => onChange(Math.min(max, Math.max(min, n)));
  function onKey(e: KeyboardEvent) {
    const delta = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 8, PageDown: -8 }[e.key];
    if (delta) {
      e.preventDefault();
      set(value + delta);
    } else if (e.key === "Home") set(min);
    else if (e.key === "End") set(max);
  }
  return (
    <div className="flex items-center gap-3">
      <IconButton label="Fewer quarters" onClick={() => set(value - 1)} disabled={value <= min}>
        <Minus aria-hidden />
      </IconButton>
      <div
        role="spinbutton"
        tabIndex={0}
        aria-label="Daily target"
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuetext={`${value} quarters, ${juzLabel(value)}`}
        onKeyDown={onKey}
        className="flex min-w-32 flex-col items-center rounded-md border border-border bg-surface-2 px-4 py-2"
      >
        <span className="font-mono text-lg font-bold text-text">{value} qtrs</span>
        <span className="text-xs text-text-muted">= {juzLabel(value)}</span>
      </div>
      <IconButton label="More quarters" onClick={() => set(value + 1)} disabled={value >= max}>
        <Plus aria-hidden />
      </IconButton>
    </div>
  );
}

const presets = [2, 4, 8, 16];

export function PresetChips({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div role="radiogroup" aria-label="Quick targets" className="flex flex-wrap gap-2">
      {presets.map((n) => {
        const on = n === value;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(n)}
            className={cn(
              "h-11 rounded-pill border px-4 text-sm font-bold transition-colors duration-(--t-duration-fast)",
              on ? "border-accent bg-accent text-on-accent" : "border-border bg-surface-2 text-text hover:bg-surface",
            )}
          >
            {n} qtrs <span className={cn("font-normal", on ? "opacity-80" : "text-text-muted")}>· {juzLabel(n)}</span>
          </button>
        );
      })}
    </div>
  );
}

export function JuzAccordion({
  juz,
  name,
  selected,
  onToggle,
  defaultOpen,
}: {
  juz: number;
  name: string;
  selected: Set<number>;
  onToggle: (rub: number) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  const panelId = useId();
  const rubs = Array.from({ length: QUARTERS_PER_JUZ }, (_, i) => (juz - 1) * QUARTERS_PER_JUZ + i + 1);
  const count = rubs.filter((r) => selected.has(r)).length;
  return (
    <div className={cn("rounded-lg border bg-surface", count ? "border-accent/40" : "border-border")}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-14 w-full items-center gap-3 rounded-lg px-4 py-3 text-left"
      >
        <span className="grid size-8 place-items-center rounded-pill bg-surface-2 font-mono text-sm font-bold text-text">{juz}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-base font-extrabold text-text">Juz {juz} · {name}</span>
          <span className="block text-xs text-text-muted">{count} of 8 picked</span>
        </span>
        <span aria-hidden className="hidden gap-1 sm:flex">
          {rubs.map((r) => (
            <span key={r} className={cn("size-1.5 rounded-pill", selected.has(r) ? "bg-accent" : "bg-border")} />
          ))}
        </span>
        <ChevronDown aria-hidden className={cn("size-5 text-text-muted transition-transform duration-(--t-duration-base)", open && "rotate-180")} />
      </button>
      {open && (
        <div id={panelId} className="grid grid-cols-2 gap-2 border-t border-border p-3 sm:grid-cols-4">
          {rubs.map((r, i) => {
            const on = selected.has(r);
            return (
              <label
                key={r}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-bold transition-colors",
                  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
                  on ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface-2 text-text",
                )}
              >
                <input type="checkbox" className="size-4 shrink-0 accent-(--color-accent)" checked={on} onChange={() => onToggle(r)} />
                <span aria-hidden>Q{i + 1}</span>
                <span className="sr-only">Quarter {i + 1}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
