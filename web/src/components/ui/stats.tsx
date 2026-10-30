"use client";

import { ChevronRight, Trash2, Trophy } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Badge } from "./badge";
import { IconButton } from "./button";

export function StatCard({ label, value, unit, sub, icon }: { label: string; value: string; unit?: string; sub: string; icon: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="eyebrow">{label}</span>
        <span aria-hidden className="grid size-8 place-items-center rounded-pill bg-surface-2 text-highlight [&_svg]:size-4">
          {icon}
        </span>
      </div>
      <p className="font-display text-xl text-text">
        {value} {unit && <span className="text-sm font-bold text-text-muted">{unit}</span>}
      </p>
      <p className="text-sm text-text-muted">{sub}</p>
    </div>
  );
}

export type DayBar = { day: string; full: string; value: number };

export function WeeklyBarChart({
  data,
  goal,
  selected,
  onSelect,
}: {
  data: DayBar[];
  goal: number;
  selected?: number;
  onSelect?: (i: number) => void;
}) {
  const top = Math.max(goal * 1.5, ...data.map((d) => d.value), 1);
  const goalPct = (goal / top) * 100;
  return (
    <figure className="flex flex-col gap-2">
      <div className="relative h-40">
        <div aria-hidden className="absolute inset-x-0 border-t-2 border-dashed border-text-muted/50" style={{ bottom: `${goalPct}%` }}>
          <span className="absolute -top-5 right-0 text-xs font-bold text-text-muted">goal {goal}</span>
        </div>
        <div className="absolute inset-0 grid grid-cols-7 items-end gap-2">
          {data.map((d, i) => {
            const met = d.value >= goal;
            return (
              // The whole column is the hit area; the bar inside is only the picture.
              <button
                key={d.day}
                type="button"
                onClick={() => onSelect?.(i)}
                aria-label={`${d.full}: ${d.value} quarters${met ? ", goal met" : ""}`}
                aria-pressed={selected === i}
                className="flex h-full w-full items-end rounded-sm"
              >
                <span
                  aria-hidden
                  className={cn(
                    "block w-full rounded-t-sm transition-[height] duration-(--t-duration-base)",
                    d.value === 0 ? "bg-border" : met ? "bg-solid-success" : "bg-accent",
                    selected === i && "outline-2 outline-offset-2 outline-focus",
                  )}
                  style={{ height: d.value === 0 ? 4 : `${(d.value / top) * 100}%` }}
                />
              </button>
            );
          })}
        </div>
      </div>
      <div aria-hidden className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-text-muted">
        {data.map((d) => (
          <span key={d.day}>{d.day}</span>
        ))}
      </div>
      <figcaption className="sr-only">Quarters revised each day this week, against a goal of {goal}.</figcaption>
    </figure>
  );
}

export function DayRow({
  date,
  done,
  target,
  juz,
  selected,
  onDelete,
}: {
  date: string;
  done: number;
  target: number;
  juz: string;
  selected?: boolean;
  onDelete?: () => void;
}) {
  const met = done >= target;
  return (
    <div className={cn("flex items-center gap-2 rounded-md border p-2 pl-3", selected ? "border-accent/50 bg-accent-soft" : "border-border bg-surface")}>
      <a href="#" className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-sm">
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-md border font-mono text-sm font-bold",
            met ? "border-success/40 bg-success-soft text-success" : "border-accent/30 bg-accent-soft text-accent",
          )}
        >
          {done}/{target}
        </span>
        <span className="min-w-0">
          <span className="block font-display text-base font-extrabold text-text">{date}</span>
          <span className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
            {met ? (
              <Badge tone="success" icon={<Trophy aria-hidden />}>
                Goal met
              </Badge>
            ) : (
              <Badge tone="accent">In progress</Badge>
            )}
            {juz}
          </span>
        </span>
        <ChevronRight aria-hidden className="ml-auto size-5 shrink-0 text-text-muted" />
      </a>
      <IconButton label={`Delete log for ${date}`} onClick={onDelete}>
        <Trash2 aria-hidden />
      </IconButton>
    </div>
  );
}
