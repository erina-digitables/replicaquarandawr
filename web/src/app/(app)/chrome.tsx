"use client";

import { BarChart3, CheckSquare, History } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { signOut } from "@/app/actions/auth";
import { setTheme } from "@/app/actions/dawr";
import { AppHeader } from "@/components/ui/app-header";
import { cn } from "@/lib/cn";

function effectiveTheme(): "light" | "dark" {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function Chrome({ email, streak, atRisk }: { email: string; streak: number; atRisk: boolean }) {
  const pathname = usePathname();
  const [theme, setLocal] = useState<"light" | "dark">("light");
  const [, start] = useTransition();
  useEffect(() => setLocal(effectiveTheme()), []);

  function toggle() {
    const next = effectiveTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next; // instant; the action saves it
    setLocal(next);
    start(() => setTheme(next));
  }

  const active = pathname.startsWith("/history") ? "history" : pathname.startsWith("/settings") ? "settings" : undefined;

  return (
    <>
      <AppHeader email={email} streak={streak} atRisk={atRisk} theme={theme} onToggleTheme={toggle} signOutAction={signOut} active={active} />
      <TopNav pathname={pathname} />
    </>
  );
}

const links = [
  { href: "/today", label: "Today", icon: CheckSquare, match: ["/today", "/plan"] },
  { href: "/stats", label: "Progress", icon: BarChart3, match: ["/stats"] },
  { href: "/history", label: "History", icon: History, match: ["/history"] },
];

function TopNav({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Main" className="rounded-lg border border-border bg-surface-2 p-1">
      <ul className="flex gap-1">
        {links.map(({ href, label, icon: Icon, match }) => {
          const on = match.some((m) => pathname.startsWith(m));
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center justify-center gap-2 rounded-md border px-3 text-sm font-bold transition-colors",
                  on ? "border-border bg-surface text-text shadow-card" : "border-transparent text-text-muted hover:text-text",
                )}
              >
                <Icon aria-hidden className="size-4" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
