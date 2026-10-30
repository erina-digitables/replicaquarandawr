"use client";

import { useRouter } from "next/navigation";
import { WeeklyBarChart } from "@/components/ui/stats";
import { formatDay } from "@/lib/dates";

export function WeekChart({ week, goal, selected }: { week: { date: string; value: number }[]; goal: number; selected: string }) {
  const router = useRouter();
  return (
    <WeeklyBarChart
      goal={goal}
      selected={week.findIndex((w) => w.date === selected)}
      onSelect={(i) => router.push(`/today?date=${week[i].date}`)}
      data={week.map((w) => ({
        day: formatDay(w.date, { weekday: "short" }),
        full: formatDay(w.date, { weekday: "long", day: "numeric", month: "long" }),
        value: w.value,
      }))}
    />
  );
}
