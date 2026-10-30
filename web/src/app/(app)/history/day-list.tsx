"use client";

import { Search, SearchX } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { deleteDay, restoreDay } from "@/app/actions/dawr";
import { Toast, EmptyState } from "@/components/ui/feedback";
import { DayRow } from "@/components/ui/stats";
import { Segmented } from "@/components/ui/segmented";
import type { DayLog, DaySummary } from "@/lib/data/types";
import { formatDay } from "@/lib/dates";

type Filter = "all" | "met" | "open";

function juzText(juz: number[]) {
  if (!juz.length) return "Nothing rated";
  const contiguous = juz.every((j, i) => i === 0 || j === juz[i - 1] + 1);
  if (juz.length === 1) return `Juz ${juz[0]}`;
  return contiguous ? `Juz ${juz[0]}-${juz.at(-1)}` : `Juz ${juz.join(", ")}`;
}

export function DayList({ days, today, selected, searchable = true }: { days: DaySummary[]; today: string; selected?: string; searchable?: boolean }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [undo, setUndo] = useState<{ day: DayLog; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  // The undo toast waits while the pointer or keyboard focus is on it (components.md: Toast).
  const [holding, setHolding] = useState(false);
  useEffect(() => {
    if (!undo || holding) return;
    const t = setTimeout(() => setUndo(null), 8000);
    return () => clearTimeout(t);
  }, [undo, holding]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const juzQ = q.replace(/^juz\s*/, "");
    return days.filter((d) => {
      if (hidden.has(d.date)) return false;
      if (filter === "met" && !d.goalMet) return false;
      if (filter === "open" && d.goalMet) return false;
      if (!q) return true;
      const text = `${formatDay(d.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} ${d.date}`.toLowerCase();
      return text.includes(q) || (/^\d+$/.test(juzQ) && d.juz.includes(Number(juzQ)));
    });
  }, [days, hidden, filter, query]);

  function remove(d: DaySummary) {
    const label = formatDay(d.date, { day: "numeric", month: "short" });
    setHidden((h) => new Set(h).add(d.date));
    setError(null);
    start(async () => {
      try {
        const removed = await deleteDay(d.date);
        if (removed) setUndo({ day: removed, label });
      } catch {
        setHidden((h) => {
          const n = new Set(h);
          n.delete(d.date);
          return n;
        });
        setError("Couldn't delete that day. Try again.");
      }
    });
  }

  function undoDelete() {
    if (!undo) return;
    const { day } = undo;
    setUndo(null);
    setHolding(false);
    start(async () => {
      await restoreDay(day);
      setHidden((h) => {
        const n = new Set(h);
        n.delete(day.date);
        return n;
      });
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {searchable && (
        <label className="relative block">
          <span className="sr-only">Search by date or juz</span>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search: October, 2026-10-29 or juz 3"
            className="h-11 w-full rounded-md border border-border-input bg-surface-2 pl-9 pr-3 text-base text-text placeholder:text-text-muted/70 focus-visible:bg-surface"
          />
        </label>
      )}
      <Segmented
        label="Filter days"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "All" },
          { value: "met", label: "Goal met" },
          { value: "open", label: "Short" },
        ]}
      />
      <p aria-live="polite" className="sr-only">
        {shown.length} {shown.length === 1 ? "day" : "days"} shown
      </p>
      {shown.length === 0 ? (
        days.length === 0 ? (
          <EmptyState icon={<Search />} title="No days logged yet" help="Rate a quarter on the Today screen and your first day shows up here." />
        ) : (
          <EmptyState icon={<SearchX />} title="No days match" help="Try another search or switch the filter back to All." />
        )
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((d) => (
            <li key={d.date}>
              <DayRow
                href={`/today?date=${d.date}`}
                date={formatDay(d.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                done={d.done}
                target={d.target}
                juz={juzText(d.juz)}
                needsWork={d.needsWork}
                openLabel={d.date === today ? "In progress" : "Short of goal"}
                selected={d.date === selected}
                onDelete={() => remove(d)}
              />
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-sm font-bold text-danger">
          {error}
        </p>
      )}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-10 flex justify-center px-4">
        <div
          className="pointer-events-auto w-full max-w-sm"
          onPointerEnter={() => setHolding(true)}
          onPointerLeave={() => setHolding(false)}
          onFocus={() => setHolding(true)}
          onBlur={() => setHolding(false)}
        >
          {undo && <Toast onUndo={undoDelete}>Deleted the log for {undo.label}</Toast>}
        </div>
      </div>
    </div>
  );
}
