import type { Metadata } from "next";
import { backend } from "@/lib/data";
import { requireUser, userToday } from "@/lib/session";
import { DayList } from "./day-list";

export const metadata: Metadata = { title: "History" };

export default async function HistoryPage() {
  const user = await requireUser();
  const days = await backend.listDays(user.id);
  const total = days.reduce((a, d) => a + d.done, 0);
  const met = days.filter((d) => d.goalMet).length;
  const juzCount = new Map<number, number>();
  for (const d of days) for (const j of d.juz) juzCount.set(j, (juzCount.get(j) ?? 0) + 1);
  const topJuz = [...juzCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  return (
    <section aria-labelledby="history-title" className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 sm:p-6">
      <div>
        <h1 id="history-title" className="font-display text-lg text-text">
          History
        </h1>
        <p className="text-sm text-text-muted">Every day you logged. Open one to see or change its ratings.</p>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center">
        {[
          ["Days", days.length],
          ["Goal met", met],
          ["Quarters", total],
        ].map(([k, v]) => (
          <div key={k} className="rounded-md bg-surface-2 px-2 py-3">
            <dt className="eyebrow">{k}</dt>
            <dd className="font-display text-xl text-text">{v}</dd>
          </div>
        ))}
      </dl>
      {topJuz && <p className="text-sm text-text-muted">Most revised: Juz {topJuz}</p>}
      <DayList days={days} today={userToday(user)} />
    </section>
  );
}
