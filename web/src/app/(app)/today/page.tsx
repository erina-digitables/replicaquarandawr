import { CalendarPlus, Lock, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui/feedback";
import { DateNavigator } from "@/components/ui/progress";
import { backend } from "@/lib/data";
import { addDays, formatDay, relativeLabel } from "@/lib/dates";
import { checklistFor } from "@/lib/dawr";
import { portionTitle, quarter, quarterStart, quarterTitle } from "@/lib/quarters";
import { pickDate, requireUser, userToday } from "@/lib/session";
import { DayTabs } from "../day-tabs";
import { TodayBoard } from "./today-board";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await requireUser();
  const date = pickDate(user, (await searchParams).date);
  const today = userToday(user);
  const isToday = date === today;
  const [day, previous] = await Promise.all([backend.getDay(user.id, date), backend.previousActiveDay(user.id, date)]);
  const { rubs, source, locked } = checklistFor(day, previous, user.dailyTarget);
  const target = day?.target ?? user.dailyTarget;
  const qualities = new Map(day?.quarters.map((q) => [q.rub, q.quality]) ?? []);
  const lastDone = previous?.quarters.filter((q) => q.quality).map((q) => q.rub).sort((a, b) => b - a)[0];
  // A past day with nothing logged shows an empty state instead of a guess.
  const emptyPast = !isToday && !day;

  return (
    <>
      <h1 className="sr-only">Revision for {formatDay(date, { weekday: "long", day: "numeric", month: "long" })}</h1>
      <DateNavigator
        label={relativeLabel(date, today)}
        date={formatDay(date, { day: "numeric", month: "short", year: "numeric" })}
        prevHref={`/today?date=${addDays(date, -1)}`}
        nextHref={`/today?date=${addDays(date, 1)}`}
        isToday={isToday}
      />
      <DayTabs active="today" date={date} />

      {emptyPast ? (
        <EmptyState
          icon={<CalendarPlus />}
          title="Nothing logged on this day"
          help="Forgot to log it? Plan the quarters you read and rate them here."
          action={
            <Link href={`/plan?date=${date}`} className="inline-flex h-11 items-center gap-2 rounded-md bg-accent px-4 text-sm font-bold text-on-accent hover:bg-accent-hover">
              Log this day
            </Link>
          }
        />
      ) : (
        <>
          {source === "suggested" && (
            <p className="flex items-start gap-2 rounded-md border border-border bg-surface px-4 py-3 text-sm text-text-muted">
              <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-highlight" />
              <span>
                {lastDone ? <>Picking up after {quarter(lastDone).code}. </> : <>Starting from the beginning. </>}
                <Link href={`/plan?date=${date}`} className="font-bold text-accent underline-offset-2 hover:underline">
                  Choose different quarters
                </Link>
              </span>
            </p>
          )}
          {locked && (
            <p className="flex items-center gap-2 rounded-md border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-text">
              <Lock aria-hidden className="size-4 shrink-0 text-accent" />
              <span className="flex-1">Showing your plan only.</span>
              <Link href={`/plan?date=${date}`} className="-my-3 inline-flex min-h-11 items-center px-1 font-bold text-accent underline-offset-2 hover:underline">
                Edit plan
              </Link>
            </p>
          )}
          <TodayBoard
            date={date}
            target={target}
            title={portionTitle(rubs)}
            eyebrow={isToday ? "Today's portion" : "Portion"}
            items={rubs.map((rub) => ({
              rub,
              title: quarterTitle(rub),
              subtitle: quarterStart(rub),
              code: quarter(rub).code,
              quality: qualities.get(rub) ?? null,
            }))}
          />
        </>
      )}
    </>
  );
}
