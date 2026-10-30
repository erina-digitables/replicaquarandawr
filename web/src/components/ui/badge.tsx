import { Flame } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "highlight";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-text-muted border-border",
  accent: "bg-accent-soft text-accent border-accent/20",
  success: "bg-success-soft text-success border-success/25",
  warning: "bg-warning-soft text-warning border-warning/25",
  danger: "bg-danger-soft text-danger border-danger/25",
  highlight: "bg-highlight-soft text-highlight border-highlight/25",
};

export function Badge({ tone = "neutral", icon, children, className }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1 rounded-pill border px-2 text-xs font-bold [&_svg]:size-3.5", tones[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

export function CodeTag({ children }: { children: ReactNode }) {
  return <span className="inline-flex h-6 items-center rounded-sm bg-surface-2 px-2 font-mono text-xs text-text-muted">{children}</span>;
}

export function StreakPill({ days, atRisk }: { days: number; atRisk?: boolean }) {
  const live = days > 0;
  return (
    <span
      title={atRisk ? "Finish today to keep it" : undefined}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-pill border px-3 text-sm font-bold [&_svg]:size-4",
        live ? "border-highlight/30 bg-highlight-soft text-highlight" : "border-border bg-surface-2 text-text-muted",
        atRisk && "border-dashed",
      )}
    >
      <Flame aria-hidden fill={live ? "currentColor" : "none"} />
      <span className="sr-only">Streak: </span>
      {days} {days === 1 ? "day" : "days"}
    </span>
  );
}
