// Pure revision logic: no I/O, so it can be unit tested and reused by the real backend.
import { addDays, weekStart, type ISODate } from "./dates";
import type { DayLog, DaySummary } from "./data/types";
import { quarter, TOTAL_QUARTERS } from "./quarters";

export function summarize(log: DayLog): DaySummary {
  const done = log.quarters.filter((q) => q.quality);
  return {
    date: log.date,
    target: log.target,
    done: done.length,
    needsWork: done.filter((q) => q.quality === "needs_work").length,
    goalMet: done.length >= log.target,
    juz: [...new Set(done.map((q) => quarter(q.rub).juz))].sort((a, b) => a - b),
  };
}

/**
 * Consecutive goal-met days ending today, or ending yesterday while today is
 * still in progress, so the streak does not drop to 0 first thing in the morning.
 */
export function streak(summaries: DaySummary[], today: ISODate) {
  const met = new Set(summaries.filter((s) => s.goalMet).map((s) => s.date));
  let day = met.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (met.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

/** Today's streak is alive (yesterday met) but today is not met yet. */
export function streakAtRisk(summaries: DaySummary[], today: ISODate) {
  const met = new Set(summaries.filter((s) => s.goalMet).map((s) => s.date));
  return !met.has(today) && met.has(addDays(today, -1));
}

/**
 * The quarters to read when the day has no plan: carry on after the highest
 * quarter finished on the most recent earlier day, wrapping 240 -> 1.
 */
export function suggestQuarters(previous: DayLog | undefined, count: number): number[] {
  const done = previous?.quarters.filter((q) => q.quality).map((q) => q.rub) ?? [];
  const start = done.length ? (Math.max(...done) % TOTAL_QUARTERS) + 1 : 1;
  return Array.from({ length: Math.min(count, TOTAL_QUARTERS) }, (_, i) => ((start - 1 + i) % TOTAL_QUARTERS) + 1);
}

/** Which quarters to show on a day's checklist, in reading order. */
export function checklistFor(log: DayLog | undefined, previous: DayLog | undefined, target: number) {
  const planned = log?.quarters.filter((q) => q.planned).map((q) => q.rub) ?? [];
  const done = log?.quarters.filter((q) => q.quality).map((q) => q.rub) ?? [];
  const base = planned.length ? planned : suggestQuarters(previous, log?.target ?? target);
  const rubs = [...new Set([...base, ...done])].sort((a, b) => a - b);
  return { rubs, source: planned.length ? ("plan" as const) : ("suggested" as const), locked: !!log?.planLocked };
}

export function stats(summaries: DaySummary[], date: ISODate) {
  const month = date.slice(0, 7);
  const year = date.slice(0, 4);
  const inMonth = summaries.filter((s) => s.date.startsWith(month));
  const inYear = summaries.filter((s) => s.date.startsWith(year));
  const start = weekStart(date);
  const byDate = new Map(summaries.map((s) => [s.date, s]));
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i);
    return { date: d, value: byDate.get(d)?.done ?? 0, target: byDate.get(d)?.target ?? null };
  });
  const weekTotal = week.reduce((a, w) => a + w.value, 0);
  const daysSoFar = week.filter((w) => w.date <= date).length;
  return {
    monthTotal: inMonth.reduce((a, s) => a + s.done, 0),
    monthGoalDays: inMonth.filter((s) => s.goalMet).length,
    yearTotal: inYear.reduce((a, s) => a + s.done, 0),
    week,
    weekStart: start,
    weekTotal,
    weekAverage: daysSoFar ? weekTotal / daysSoFar : 0,
  };
}
