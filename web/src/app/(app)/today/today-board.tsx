"use client";

import { useEffect, useOptimistic, useState, useTransition } from "react";
import { rateQuarter } from "@/app/actions/dawr";
import { Toast } from "@/components/ui/feedback";
import { GoalCard } from "@/components/ui/progress";
import { QuarterCard, type Quality } from "@/components/ui/quarter-card";

type Item = { rub: number; title: string; subtitle: string; code: string; quality: Quality | null };

export function TodayBoard({ date, target, title, eyebrow, items }: { date: string; target: number; title: string; eyebrow: string; items: Item[] }) {
  const [optimistic, apply] = useOptimistic(
    new Map(items.map((i) => [i.rub, i.quality])),
    (state, { rub, quality }: { rub: number; quality: Quality | null }) => new Map(state).set(rub, quality),
  );
  // Saves in flight per quarter. Plain state, set before the transition starts so it
  // renders at once (BUG-005), and cleared by hand when the save settles. Not
  // useOptimistic: that only clears once every transition on the page has finished,
  // and a very fast reply could leave one of the router's open forever (BUG-010).
  const [saving, setSaving] = useState<Map<number, number>>(new Map());
  const track = (rub: number, delta: 1 | -1) =>
    setSaving((m) => {
      const n = new Map(m);
      const left = (n.get(rub) ?? 0) + delta;
      if (left > 0) n.set(rub, left);
      else n.delete(rub);
      return n;
    });
  const [failed, setFailed] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [, start] = useTransition();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  function rate(rub: number, quality: Quality | null) {
    track(rub, 1);
    start(async () => {
      apply({ rub, quality });
      try {
        await rateQuarter(date, rub, quality);
        setFailed((s) => {
          const n = new Set(s);
          n.delete(rub);
          return n;
        });
      } catch {
        setFailed((s) => new Set(s).add(rub));
        setToast("Couldn't save that rating. Check your connection and tap it again.");
      } finally {
        track(rub, -1);
      }
    });
  }

  const done = [...optimistic.values()].filter(Boolean).length;

  return (
    <>
      <GoalCard title={title} done={done} target={target} eyebrow={eyebrow} />
      <section aria-labelledby="checklist-title" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <h2 id="checklist-title" className="eyebrow">
            Rate each quarter as you finish it
          </h2>
          <span className="font-mono text-xs font-bold text-text-muted">
            {done}/{items.length}
          </span>
        </div>
        {items.map((i) => (
          <QuarterCard
            key={i.rub}
            title={i.title}
            subtitle={i.subtitle}
            code={i.code}
            quality={optimistic.get(i.rub) ?? null}
            onChange={(q) => rate(i.rub, q)}
            saving={saving.has(i.rub)}
            error={failed.has(i.rub)}
          />
        ))}
        <p className="px-1 text-xs text-text-muted">Ratings save as you tap. Weak quarters are worth another read tomorrow.</p>
      </section>
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-10 flex justify-center px-4">
        <div className="pointer-events-auto w-full max-w-sm">{toast && <Toast tone="error">{toast}</Toast>}</div>
      </div>
    </>
  );
}
