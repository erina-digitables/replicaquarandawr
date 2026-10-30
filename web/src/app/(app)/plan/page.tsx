import type { Metadata } from "next";
import { DateNavigator } from "@/components/ui/progress";
import { getDay, previousActiveDay } from "@/lib/data";
import { addDays, formatDay, relativeLabel } from "@/lib/dates";
import { suggestQuarters } from "@/lib/dawr";
import { pickDate, requireUser, userToday } from "@/lib/session";
import { DayTabs } from "../day-tabs";
import { PlanBuilder } from "./plan-builder";

export const metadata: Metadata = { title: "Plan the day" };

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await requireUser();
  const date = pickDate(user, (await searchParams).date);
  const today = userToday(user);
  const [day, previous] = await Promise.all([getDay(user.id, date), previousActiveDay(user.id, date)]);
  const planned = day?.quarters.filter((q) => q.planned).map((q) => q.rub) ?? [];
  const done = day?.quarters.filter((q) => q.quality).map((q) => q.rub) ?? [];

  return (
    <>
      <h1 className="sr-only">Plan revision for {formatDay(date, { weekday: "long", day: "numeric", month: "long" })}</h1>
      <DateNavigator
        label={relativeLabel(date, today)}
        date={formatDay(date, { day: "numeric", month: "short", year: "numeric" })}
        prevHref={`/plan?date=${addDays(date, -1)}`}
        nextHref={`/plan?date=${addDays(date, 1)}`}
        isToday={date === today}
      />
      <DayTabs active="plan" date={date} />
      <PlanBuilder
        key={date}
        date={date}
        target={user.dailyTarget}
        planned={planned}
        done={done}
        locked={!!day?.planLocked}
        suggestion={suggestQuarters(previous, user.dailyTarget)}
      />
    </>
  );
}
