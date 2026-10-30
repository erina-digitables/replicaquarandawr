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
  // Optimistic too: a plain state update inside the transition would only render once
  // the save had finished, so the card never showed it was saving (BUG-005).
  const [saving, markSaving] = useOptimistic(new Set<number>(), (state, rub: number) => new Set(state).add(rub));
  const [failed, setFailed] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [, start] = useTransition();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  function rate(rub: number, quality: Quality | null) {
    start(async () => {
      apply({ rub, quality });
      markSaving(rub);
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
