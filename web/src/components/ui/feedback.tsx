import { CheckCircle2, CircleAlert, Undo2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./button";

export function Toast({ tone = "success", children, onUndo }: { tone?: "success" | "error"; children: ReactNode; onUndo?: () => void }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className="flex w-full max-w-sm items-center gap-3 rounded-lg border border-border bg-surface p-3 pl-4 shadow-pop"
    >
      {tone === "error" ? (
        <CircleAlert aria-hidden className="size-5 shrink-0 text-danger" />
      ) : (
        <CheckCircle2 aria-hidden className="size-5 shrink-0 text-success" />
      )}
      <p className="flex-1 text-sm text-text">{children}</p>
      {onUndo && (
        <Button variant="ghost" size="sm" icon={<Undo2 aria-hidden className="size-4" />} onClick={onUndo}>
          Undo
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, help, action }: { icon: ReactNode; title: string; help: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-surface px-6 py-10 text-center">
      <span aria-hidden className="grid size-12 place-items-center rounded-pill bg-surface-2 text-text-muted [&_svg]:size-6">
        {icon}
      </span>
      <div>
        <p className="font-display text-base font-extrabold text-text">{title}</p>
        <p className="mt-1 text-sm text-text-muted">{help}</p>
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-xl border border-border bg-surface p-6 shadow-card", className)}>{children}</section>;
}
