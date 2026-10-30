"use client";

import { BookOpenCheck, History, LogOut, Moon, Settings, Sun } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { StreakPill } from "./badge";
import { IconButton } from "./button";

const iconLink = (on: boolean) =>
  cn(
    "inline-grid size-11 shrink-0 place-items-center rounded-pill border transition-colors [&_svg]:size-5",
    on ? "border-highlight/40 bg-highlight-soft text-highlight" : "border-border bg-surface-2 text-text-muted hover:text-text",
  );

export function AppHeader({
  email,
  streak,
  atRisk,
  theme,
  onToggleTheme,
  signOutAction,
  active,
}: {
  email: string;
  streak: number;
  atRisk?: boolean;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  signOutAction?: () => void;
  active?: "history" | "settings";
}) {
  return (
    <header className="flex h-16 items-center gap-2 rounded-xl border border-border bg-surface px-3 shadow-card">
      <Link href="/today" className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-md bg-accent text-on-accent">
          <BookOpenCheck className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-display text-base font-extrabold text-text">Dawr</span>
          <span className="hidden truncate text-xs text-text-muted md:block">{email}</span>
        </span>
      </Link>
      <StreakPill days={streak} atRisk={atRisk} />
      <IconButton label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} onClick={onToggleTheme}>
        {theme === "dark" ? <Sun aria-hidden /> : <Moon aria-hidden />}
      </IconButton>
      {/* History and sign out live in the top nav and Settings below tablet width, so the row never overflows */}
      <span className="hidden md:contents">
        <Link href="/history" aria-label="History" title="History" aria-current={active === "history" ? "page" : undefined} className={iconLink(active === "history")}>
          <History aria-hidden />
        </Link>
      </span>
      <Link href="/settings" aria-label="Settings" title="Settings" aria-current={active === "settings" ? "page" : undefined} className={iconLink(active === "settings")}>
        <Settings aria-hidden />
      </Link>
      {signOutAction && (
        <form action={signOutAction} className="hidden md:contents">
          <IconButton label="Sign out" type="submit">
            <LogOut aria-hidden />
          </IconButton>
        </form>
      )}
    </header>
  );
}
