import { BookOpenCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { ThemeButton } from "./theme-button";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await currentUser()) redirect("/today");
  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-(--container-column) flex-col px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeButton />
      </div>
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <span aria-hidden className="grid size-14 place-items-center rounded-lg bg-accent text-on-accent">
          <BookOpenCheck className="size-7" />
        </span>
        <div>
          <p className="font-display text-xl text-text">Dawr</p>
          <p className="text-sm text-text-muted">Keep your hifz fresh, one quarter at a time.</p>
        </div>
      </div>
      <main className="rounded-xl border border-border bg-surface p-6 shadow-card">{children}</main>
    </div>
  );
}
