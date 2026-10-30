import { CalendarDays, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "./badge";
import { IconButton } from "./button";

export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
  const met = value >= max;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.min(value, max)}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuetext={`${value} of ${max} quarters`}
      className="h-2 w-full overflow-hidden rounded-pill bg-surface-2"
    >
      <div
        className={cn("h-full rounded-pill transition-[width] duration-(--t-duration-base) ease-out", met ? "bg-solid-success" : "bg-accent")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function GoalCard({ title, done, target }: { title: string; done: number; target: number }) {
  const met = done >= target;
  const status = done === 0 ? "Not started" : met ? "Goal met" : "In progress";
  return (
    <section
      aria-labelledby="goal-title"
      className={cn("flex flex-col gap-4 rounded-xl border bg-surface p-6", met ? "border-success/40" : "border-border")}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent">Today&apos;s portion</Badge>
        <Badge tone={met ? "success" : done ? "highlight" : "neutral"}>{status}</Badge>
      </div>
      <div>
        <h2 id="goal-title" className="font-display text-lg text-text">
          {title}
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          <span className="font-mono font-bold text-text">{done}</span> of {target} quarters read
          {done > target && " · beyond today's goal"}
        </p>
      </div>
      <ProgressBar value={done} max={target} label="Today's progress" />
      {met && (
        <div role="status" className="flex items-start gap-3 rounded-lg border border-success/30 bg-success-soft p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-solid-success text-on-solid">
            <Sparkles aria-hidden className="size-5" />
          </span>
          <div>
            <p className="font-display text-base font-extrabold text-text">Goal met for today</p>
            <p className="text-sm text-text-muted">Every quarter you planned is done. Barakallahu feek.</p>
          </div>
        </div>
      )}
    </section>
  );
}

export function DateNavigator({
  label,
  date,
  onPrev,
  onNext,
  isToday,
}: {
  label: string;
  date: string;
  onPrev?: () => void;
  onNext?: () => void;
  isToday?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface p-2">
      <IconButton label="Previous day" onClick={onPrev}>
        <ChevronLeft aria-hidden />
      </IconButton>
      <p aria-live="polite" className="flex items-center gap-2 text-sm">
        <CalendarDays aria-hidden className="size-4 text-highlight" />
        <span className="font-display font-extrabold text-text">{label}</span>
        <span className="font-mono text-xs text-text-muted">{date}</span>
      </p>
      <IconButton label="Next day" onClick={onNext} disabled={isToday}>
        <ChevronRight aria-hidden />
      </IconButton>
    </div>
  );
}
