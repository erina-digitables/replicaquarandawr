"use client";

import { Check, Copy, HelpCircle, LogOut, Sunrise, Target, TriangleAlert, User, Layers, Moon } from "lucide-react";
import { useActionState, useId, useMemo, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { signOut } from "@/app/actions/auth";
import {
  changePassword,
  deleteAccount,
  resetAllLogs,
  setDailyTarget,
  setTheme,
  updateAccount,
  type SettingsState,
} from "@/app/actions/dawr";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/feedback";
import { Segmented } from "@/components/ui/segmented";
import { PresetChips, TargetStepper } from "@/components/ui/target";
import { TextField } from "@/components/ui/text-field";
import type { Profile, Theme } from "@/lib/data/types";
import { cn } from "@/lib/cn";
import { juzLabel } from "@/lib/quarters";

type Tab = "goal" | "account" | "tips";

export function Settings({ profile, initialTab }: { profile: Profile; initialTab: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  return (
    <>
      <h1 className="sr-only">Settings</h1>
      <Segmented
        label="Settings sections"
        value={tab}
        onChange={(t) => {
          setTab(t);
          history.replaceState(null, "", `/settings?tab=${t}`);
        }}
        options={[
          { value: "goal", label: "Goal", icon: <Target aria-hidden /> },
          { value: "account", label: "Account", icon: <User aria-hidden /> },
          { value: "tips", label: "Tips", icon: <HelpCircle aria-hidden /> },
        ]}
      />
      <div role="tabpanel" aria-label={tab} className="flex flex-col gap-4">
        {tab === "goal" && <GoalPanel target={profile.dailyTarget} />}
        {tab === "account" && <AccountPanel profile={profile} />}
        {tab === "tips" && <TipsPanel />}
      </div>
      <form action={signOut}>
        <Button type="submit" variant="secondary" block icon={<LogOut aria-hidden className="size-4" />}>
          Sign out
        </Button>
      </form>
    </>
  );
}

function SubmitButton({ children, variant = "primary" }: { children: React.ReactNode; variant?: "primary" | "danger" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} loading={pending}>
      {children}
    </Button>
  );
}

function Saved({ state }: { state: SettingsState }) {
  if (!state?.ok) return null;
  return (
    <p role="status" className="flex items-center gap-1.5 text-sm font-bold text-success">
      <Check aria-hidden className="size-4" /> {state.ok}
    </p>
  );
}

function GoalPanel({ target: initial }: { target: number }) {
  const [target, setTarget] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [, start] = useTransition();
  function change(n: number) {
    setTarget(n);
    setSaved(false);
    start(async () => {
      await setDailyTarget(n);
      setSaved(true);
    });
  }
  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-base font-extrabold text-text">Daily goal</h2>
        <p className="text-sm text-text-muted">
          {target} quarters is {juzLabel(target)}. A juz has 8 quarters, so 8 a day finishes the Quran in a month.
        </p>
      </div>
      <TargetStepper value={target} onChange={change} />
      <PresetChips value={target} onChange={change} />
      <p role="status" className="min-h-5 text-sm font-bold text-success">
        {saved && "Saved. New days use this goal."}
      </p>
    </Card>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const id = useId();
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p id={id} className="eyebrow">
          {label}
        </p>
        <p className="truncate text-base text-text">{value}</p>
      </div>
      <button
        type="button"
        aria-describedby={id}
        aria-label={`Copy ${label.toLowerCase()}`}
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="grid size-11 place-items-center rounded-pill text-text-muted hover:text-text"
      >
        {copied ? <Check aria-hidden className="size-4 text-success" /> : <Copy aria-hidden className="size-4" />}
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied" : ""}
      </span>
    </div>
  );
}

function ThemeChoice({ current }: { current: Theme }) {
  const [theme, setLocal] = useState(current);
  const [, start] = useTransition();
  const options: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: "system", label: "Match device", icon: <Layers aria-hidden className="size-4" /> },
    { value: "light", label: "Light", icon: <Sunrise aria-hidden className="size-4" /> },
    { value: "dark", label: "Dark", icon: <Moon aria-hidden className="size-4" /> },
  ];
  function pick(t: Theme) {
    setLocal(t);
    if (t === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
    start(() => setTheme(t));
  }
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="eyebrow mb-1">Appearance</legend>
      <div role="radiogroup" aria-label="Appearance" className="grid grid-cols-3 gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={theme === o.value}
            onClick={() => pick(o.value)}
            className={cn(
              "flex min-h-11 flex-col items-center justify-center gap-1 rounded-md border px-2 py-2 text-sm font-bold",
              theme === o.value ? "border-accent bg-accent text-on-accent" : "border-border bg-surface-2 text-text",
            )}
          >
            {o.icon}
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function AccountPanel({ profile }: { profile: Profile }) {
  const [state, action] = useActionState(updateAccount, null);
  const [pw, pwAction] = useActionState(changePassword, null);
  const [reset, resetAction] = useActionState(resetAllLogs, null);
  const [del, delAction] = useActionState(deleteAccount, null);
  const zones = useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return [profile.timezone];
    }
  }, [profile.timezone]);

  return (
    <>
      <Card className="flex flex-col gap-4">
        <h2 className="font-display text-base font-extrabold text-text">Profile</h2>
        {profile.isDemo && (
          <p className="rounded-md border border-highlight/30 bg-highlight-soft px-3 py-2 text-sm text-text">
            This is a temporary sample account. Create your own to keep your progress.
          </p>
        )}
        <form action={action} className="flex flex-col gap-4">
          <TextField label="Your name" name="fullName" defaultValue={profile.fullName} maxLength={80} error={state?.fields?.fullName} />
          <TextField label="Username" name="username" defaultValue={profile.username} autoCapitalize="none" error={state?.fields?.username} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="tz" className="eyebrow">
              Time zone
            </label>
            <select
              id="tz"
              name="timezone"
              defaultValue={profile.timezone}
              className="h-11 rounded-md border border-border-input bg-surface-2 px-3 text-base text-text"
            >
              {zones.map((z) => (
                <option key={z}>{z}</option>
              ))}
            </select>
            <p className="text-xs text-text-muted">Your day starts at midnight here. Logged days keep their dates if you change it.</p>
          </div>
          <div className="flex items-center gap-3">
            <SubmitButton>Save profile</SubmitButton>
            <Saved state={state} />
          </div>
        </form>
        <CopyField label="Email" value={profile.email} />
        <ThemeChoice current={profile.theme} />
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="font-display text-base font-extrabold text-text">Change password</h2>
        <form action={pwAction} className="flex flex-col gap-4">
          <TextField label="Current password" name="current" variant="password" autoComplete="current-password" error={pw?.fields?.current} />
          <TextField label="New password" name="next" variant="password" autoComplete="new-password" error={pw?.fields?.next} hint="At least 8 characters." />
          <div className="flex items-center gap-3">
            <SubmitButton>Change password</SubmitButton>
            <Saved state={pw} />
          </div>
        </form>
      </Card>

      <Card className="flex flex-col gap-5 border-danger/40">
        <h2 className="flex items-center gap-2 font-display text-base font-extrabold text-danger">
          <TriangleAlert aria-hidden className="size-5" /> Danger zone
        </h2>
        <form action={resetAction} className="flex flex-col gap-3">
          <p className="text-sm text-text-muted">Delete every logged day and start your history over. Your account and goal stay.</p>
          <TextField label="Type RESET to confirm" name="confirm" autoCapitalize="characters" autoComplete="off" error={reset?.fields?.confirm} />
          <div className="flex items-center gap-3">
            <SubmitButton variant="danger">Delete all logs</SubmitButton>
            <Saved state={reset} />
          </div>
        </form>
        <form action={delAction} className="flex flex-col gap-3 border-t border-border pt-5">
          <p className="text-sm text-text-muted">Delete your account and everything in it. This can&apos;t be undone.</p>
          <TextField label={`Type ${profile.username} to confirm`} name="confirm" autoCapitalize="none" autoComplete="off" error={del?.fields?.confirm} />
          <div>
            <SubmitButton variant="danger">Delete my account</SubmitButton>
          </div>
        </form>
      </Card>
    </>
  );
}

const tips = [
  {
    title: "Little and often beats a weekly marathon",
    body: "Half a juz every day keeps more in memory than three juz once a week. Set a goal you can hit on a busy day.",
  },
  {
    title: "Rate honestly",
    body: "Good means smooth, with a slip or two at most. Okay means you needed a couple of prompts. Weak means it needs another read soon, so plan it for tomorrow.",
  },
  {
    title: "Split it around the prayers",
    body: "Two quarters after Fajr and two after Maghrib or Isha feels lighter than four in one sitting.",
  },
];

function TipsPanel() {
  return (
    <ul className="flex flex-col gap-3">
      {tips.map((t) => (
        <li key={t.title} className="rounded-lg border border-border bg-surface p-4">
          <h2 className="font-display text-base font-extrabold text-text">{t.title}</h2>
          <p className="mt-1 text-sm text-text-muted">{t.body}</p>
        </li>
      ))}
    </ul>
  );
}
