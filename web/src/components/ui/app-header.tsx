"use client";

import { BookOpenCheck, History, LogOut, Moon, Settings, Sun } from "lucide-react";
import { StreakPill } from "./badge";
import { IconButton } from "./button";

export function AppHeader({
  email,
  streak,
  theme,
  onToggleTheme,
  active,
}: {
  email: string;
  streak: number;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  active?: "history" | "settings";
}) {
  return (
    <header className="flex h-16 items-center gap-2 rounded-xl border border-border bg-surface px-3 shadow-card">
      <a href="#" className="flex min-w-0 flex-1 items-center gap-2 rounded-md">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-md bg-accent text-on-accent">
          <BookOpenCheck className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-display text-base font-extrabold text-text">Dawr</span>
          <span className="hidden truncate text-xs text-text-muted md:block">{email}</span>
        </span>
      </a>
      <StreakPill days={streak} />
      <IconButton label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} onClick={onToggleTheme}>
        {theme === "dark" ? <Sun aria-hidden /> : <Moon aria-hidden />}
      </IconButton>
      {/* History and sign out move into Settings below tablet width, so the row never overflows */}
      <span className="hidden md:contents">
        <IconButton label="History" active={active === "history"}>
          <History aria-hidden />
        </IconButton>
      </span>
      <IconButton label="Settings" active={active === "settings"}>
        <Settings aria-hidden />
      </IconButton>
      <span className="hidden md:contents">
        <IconButton label="Sign out">
          <LogOut aria-hidden />
        </IconButton>
      </span>
    </header>
  );
}
