"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ScreenError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-danger/40 bg-danger-soft p-6">
      <p className="font-display text-lg text-text">This screen couldn&apos;t load</p>
      <p className="text-sm text-text-muted">Your saved revision is safe. Try again, and if it keeps happening, reload the page.</p>
      <Button variant="secondary" icon={<RotateCcw aria-hidden className="size-4" />} onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
