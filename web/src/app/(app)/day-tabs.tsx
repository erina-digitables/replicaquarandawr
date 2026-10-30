import { ListChecks, SquareCheckBig } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";

/** Checklist / Plan for the same day. Links, because they are separate routes. */
export function DayTabs({ active, date }: { active: "today" | "plan"; date: string }) {
  const item = (href: string, label: string, Icon: typeof ListChecks, on: boolean) => (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      className={cn(
        "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md border px-3 text-sm font-bold transition-colors",
        on ? "border-border bg-surface text-text shadow-card" : "border-transparent text-text-muted hover:text-text",
      )}
    >
      <Icon aria-hidden className="size-4" />
      {label}
    </Link>
  );
  return (
    <nav aria-label="Day" className="flex gap-1 rounded-lg border border-border bg-surface-2 p-1">
      {item(`/today?date=${date}`, "Checklist", SquareCheckBig, active === "today")}
      {item(`/plan?date=${date}`, "Plan the day", ListChecks, active === "plan")}
    </nav>
  );
}
