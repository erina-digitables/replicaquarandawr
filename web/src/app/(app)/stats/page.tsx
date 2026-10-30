import { Award, BookOpen, CalendarRange, Flame } from "lucide-react";
import type { Metadata } from "next";
import { DateNavigator } from "@/components/ui/progress";
import { StatCard } from "@/components/ui/stats";
import { backend } from "@/lib/data";
import { addDays, formatDay } from "@/lib/dates";
import { stats, streak } from "@/lib/dawr";
import { juzLabel } from "@/lib/quarters";
import { pickDate, requireUser, userToday } from "@/lib/session";
import { DayList } from "../history/day-list";
import { WeekChart } from "./week-chart";

export const metadata: Metadata = { title: "Progress" };

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await requireUser();
  const date = pickDate(user, (await searchParams).date);
  const today = userToday(user);
  const days = await backend.listDays(user.id);
  const s = stats(days, date);
  const weekEnd = addDays(s.weekStart, 6);
  const weekDays = days.filter((d) => d.date >= s.weekStart && d.date <= weekEnd);
  const monthName = formatDay(date, { month: "long" });

  return (
    <>
      <h1 className="sr-only">Progress</h1>
      <DateNavigator
        label={`Week of ${formatDay(s.weekStart, { day: "numeric", month: "short" })}`}
        date={date === today ? "this week" : formatDay(date, { day: "numeric", month: "short", year: "numeric" })}
        prevHref={`/stats?date=${addDays(s.weekStart, -1)}`}
        nextHref={`/stats?date=${addDays(weekEnd, 1)}`}
        isToday={weekEnd >= today}
      />
      <div className="grid grid-cols-2 gap-3">
        <StatCard label={monthName} value={String(s.monthTotal)} unit="qtrs" sub={`≈ ${juzLabel(s.monthTotal)} · ${s.monthGoalDays} goal days`} icon={<BookOpen />} />
        <StatCard label={date.slice(0, 4)} value={String(s.yearTotal)} unit="qtrs" sub={`≈ ${juzLabel(s.yearTotal)}`} icon={<Award />} />
        <StatCard label="Streak" value={String(streak(days, today))} unit="days" sub="Days in a row with the goal met" icon={<Flame />} />
        <StatCard
          label="This week"
          value={String(s.weekTotal)}
          unit="qtrs"
          sub={`${s.weekAverage.toFixed(1)} a day on average`}
          icon={<CalendarRange />}
        />
      </div>
      <section aria-labelledby="week-title" className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 sm:p-6">
        <div>
          <h2 id="week-title" className="font-display text-base font-extrabold text-text">
            Quarters each day
          </h2>
          <p className="text-sm text-text-muted">Tap a day to open its checklist. The dashed line is your goal of {user.dailyTarget}.</p>
        </div>
        <WeekChart week={s.week} goal={user.dailyTarget} selected={date} />
      </section>
      <section aria-labelledby="week-days-title" className="flex flex-col gap-3">
        <h2 id="week-days-title" className="eyebrow px-1">
          Logged this week
        </h2>
        <DayList days={weekDays} today={today} selected={date} searchable={false} />
      </section>
    </>
  );
}
