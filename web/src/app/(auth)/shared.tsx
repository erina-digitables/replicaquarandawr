"use client";

import { PlayCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { startDemo } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/** The browser's IANA time zone, so "today" matches the user's own calendar. */
export function TimezoneInput() {
  const [tz, setTz] = useState("UTC");
  useEffect(() => setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"), []);
  return <input type="hidden" name="timezone" value={tz} />;
}

export function SubmitButton({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" block loading={pending} icon={icon}>
      {children}
    </Button>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
      {message}
    </p>
  );
}

export function AuthTabs({ active }: { active: "signin" | "signup" }) {
  const tab = (href: string, label: string, on: boolean) => (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      className={cn(
        "flex min-h-11 flex-1 items-center justify-center text-sm font-bold",
        on ? "-mb-px border-b-2 border-accent text-text" : "text-text-muted hover:text-text",
      )}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Account" className="mb-6 flex border-b border-border">
      {tab("/signin", "Sign in", active === "signin")}
      {tab("/signup", "Create account", active === "signup")}
    </nav>
  );
}

function DemoSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" block loading={pending} icon={<PlayCircle aria-hidden className="size-4" />}>
      Try it with sample data
    </Button>
  );
}

export function DemoForm() {
  return (
    <form action={startDemo} className="mt-6 flex flex-col gap-2 border-t border-border pt-6">
      <TimezoneInput />
      <DemoSubmit />
      <p className="text-center text-xs text-text-muted">Opens a private sandbox with two weeks of example revision. Nothing to sign up for.</p>
    </form>
  );
}
