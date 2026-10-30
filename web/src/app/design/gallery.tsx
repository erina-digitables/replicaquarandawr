"use client";

import { Award, BookOpen, CalendarDays, CheckSquare, History, KeyRound, ListChecks, Mail, Search, User } from "lucide-react";
import { useState, type ReactNode } from "react";
import { AppHeader } from "@/components/ui/app-header";
import { Badge, CodeTag, StreakPill } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card, EmptyState, Toast } from "@/components/ui/feedback";
import { DateNavigator, GoalCard, ProgressBar } from "@/components/ui/progress";
import { QuarterCard, type Quality } from "@/components/ui/quarter-card";
import { Segmented } from "@/components/ui/segmented";
import { DayRow, StatCard, WeeklyBarChart } from "@/components/ui/stats";
import { JuzAccordion, PresetChips, TargetStepper } from "@/components/ui/target";
import { TextField } from "@/components/ui/text-field";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="eyebrow border-b border-border pb-2">{title}</h2>
      {children}
    </section>
  );
}

const week = [
  { day: "Mon", full: "Monday", value: 4 },
  { day: "Tue", full: "Tuesday", value: 0 },
  { day: "Wed", full: "Wednesday", value: 3 },
  { day: "Thu", full: "Thursday", value: 6 },
  { day: "Fri", full: "Friday", value: 2 },
  { day: "Sat", full: "Saturday", value: 0 },
  { day: "Sun", full: "Sunday", value: 0 },
];

export function Gallery({ theme }: { theme: "light" | "dark" }) {
  const [authTab, setAuthTab] = useState<"in" | "up">("in");
  const [nav, setNav] = useState<"today" | "stats" | "history">("today");
  const [q, setQ] = useState<Record<number, Quality | null>>({ 1: "good", 2: "average", 3: null, 4: null });
  const [target, setTarget] = useState(4);
  const [picked, setPicked] = useState(new Set([9, 10, 11, 12]));
  const [bar, setBar] = useState(3);
  const done = Object.values(q).filter(Boolean).length;

  return (
    <div data-theme={theme} className="flex flex-col gap-8 bg-bg p-4 text-text sm:p-6">
      <p className="font-display text-xl text-text">{theme === "light" ? "Light" : "Dark"}</p>

      <Section title="App header (S04-S08)">
        <AppHeader email="you@example.com" streak={5} theme={theme} onToggleTheme={() => {}} />
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap gap-2">
          <Button>Start reading</Button>
          <Button variant="secondary">Edit plan</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="danger">Reset all logs</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
          <Button loading>Saving</Button>
          <Button disabled>Disabled</Button>
          <IconButton label="Search">
            <Search aria-hidden />
          </IconButton>
          <IconButton label="History" active>
            <History aria-hidden />
          </IconButton>
        </div>
        <Button size="lg" block>
          Sign in
        </Button>
      </Section>

      <Section title="Text fields (S01-S03)">
        <TextField label="Username or email" icon={<User />} placeholder="yusuf_hifz" />
        <TextField label="Email" icon={<Mail />} defaultValue="not-an-email" error="Enter an email like name@example.com" />
        <TextField label="Password" icon={<KeyRound />} variant="password" defaultValue="hunter22" hint="At least 8 characters" />
        <TextField label="Reset code" variant="code" placeholder="123456" inputMode="numeric" />
      </Section>

      <Section title="Tabs and navigation">
        <Segmented
          label="Account"
          variant="underline"
          value={authTab}
          onChange={setAuthTab}
          options={[
            { value: "in", label: "Sign in" },
            { value: "up", label: "Create account" },
          ]}
        />
        <Segmented
          label="Sections"
          value={nav}
          onChange={setNav}
          options={[
            { value: "today", label: "Today", icon: <CheckSquare aria-hidden /> },
            { value: "stats", label: "Progress", icon: <Award aria-hidden /> },
            { value: "history", label: "History", icon: <History aria-hidden /> },
          ]}
        />
        <DateNavigator label="Today" date="30 Oct 2026" isToday />
      </Section>

      <Section title="Badges">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Neutral</Badge>
          <Badge tone="accent">Today&apos;s portion</Badge>
          <Badge tone="success">Goal met</Badge>
          <Badge tone="warning">Okay</Badge>
          <Badge tone="danger">Weak</Badge>
          <Badge tone="highlight">In progress</Badge>
          <CodeTag>J2_Q1</CodeTag>
          <StreakPill days={0} />
          <StreakPill days={1} atRisk />
          <StreakPill days={12} />
        </div>
      </Section>

      <Section title="Goal card (S04)">
        <GoalCard title="Juz 2 · quarters 1-4" done={done} target={4} />
        <GoalCard title="Juz 1 · quarters 5-8" done={4} target={4} />
        <ProgressBar value={0} max={4} label="Empty progress example" />
      </Section>

      <Section title="Quarter cards (S04)">
        <div className="grid gap-3">
          {[1, 2, 3, 4].map((n) => (
            <QuarterCard
              key={n}
              title={`Juz 2 · quarter ${n}`}
              subtitle={`Starts Al-Baqarah ${[142, 158, 177, 189][n - 1]}`}
              code={`J2_Q${n}`}
              quality={q[n]}
              onChange={(v) => setQ((s) => ({ ...s, [n]: v }))}
            />
          ))}
          <QuarterCard title="Juz 3 · quarter 1" subtitle="Starts Al-Baqarah 253" code="J3_Q1" quality={null} onChange={() => {}} saving />
          <QuarterCard title="Juz 3 · quarter 2" subtitle="Starts Al-Baqarah 263" code="J3_Q2" quality="good" onChange={() => {}} error />
        </div>
      </Section>

      <Section title="Target (S05, S08)">
        <TargetStepper value={target} onChange={setTarget} />
        <PresetChips value={target} onChange={setTarget} />
      </Section>

      <Section title="Plan builder (S05)">
        <JuzAccordion
          juz={2}
          name="Sayaqul"
          defaultOpen
          selected={picked}
          onToggle={(r) =>
            setPicked((s) => {
              const n = new Set(s);
              if (n.has(r)) n.delete(r);
              else n.add(r);
              return n;
            })
          }
        />
        <JuzAccordion juz={3} name="Tilka r-rusul" selected={picked} onToggle={() => {}} />
      </Section>

      <Section title="Statistics (S06)">
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="This month" value="38" unit="qtrs" sub="≈ 4.8 juz · 9 goal days" icon={<BookOpen />} />
          <StatCard label="This year" value="412" unit="qtrs" sub="≈ 51.5 juz" icon={<Award />} />
        </div>
        <Card>
          <WeeklyBarChart data={week} goal={4} selected={bar} onSelect={setBar} />
        </Card>
      </Section>

      <Section title="History (S07)">
        <DayRow date="Thu 29 Oct" done={6} target={4} juz="Juz 1-2" />
        <DayRow date="Fri 30 Oct" done={2} target={4} juz="Juz 2" selected />
      </Section>

      <Section title="Feedback">
        <Toast>Saved. As-salamu alaykum, Yusuf.</Toast>
        <Toast onUndo={() => {}}>Deleted the log for 29 Oct</Toast>
        <Toast tone="error">Couldn&apos;t reach the server. Your taps are kept and will retry.</Toast>
        <EmptyState
          icon={<CalendarDays />}
          title="Nothing logged yet"
          help="Your first day of revision will show up here."
          action={<Button icon={<ListChecks aria-hidden className="size-4" />}>Plan my day</Button>}
        />
      </Section>
    </div>
  );
}
