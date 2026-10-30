# Recon map: Quran Dawr (web, single-page app)

Scope: the whole app. It is small: sign-up/sign-in, the daily hifz revision checklist, plan builder, daily target, statistics and history.
For: to be confirmed. Working assumption: hifz students (and later their teachers) who want a clean daily dawr tracker.
Date: 2026-10-30

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | the app, public screens | https://quran-dawr-tracker.ai.studio | sign in, create account, forgot password, theme toggle |
| 2 | the app, signed in as the public demo account | https://quran-dawr-tracker.ai.studio | the user signed in. Demo credentials are printed on the login page. Read only: no checklist, plan, delete or reset actions were taken, so the demo data was left alone |
| 3 | the in-app "Firestore rules & schema" panel | same, in the footer link | the app shows its DB model to every user. Read the **DB Model** tab only, for entity and field names. The State Logic and Security Rules code tabs were not read |
| - | help center, pricing, changelog, store listing, videos, API docs | none exist | an AI Studio-hosted app with no marketing site. The "PRO" badge in the header has no visible pricing behind it |

## Core loop

Each day, set how many quarters (rub') of the Quran you'll revise. Pick or plan which ones, then tick each quarter off with a self-rated quality (Good / Average / Needs Work) to keep your streak and hit your daily goal.

## Domain note (read before architecting)

The original treats **a juz as 4 quarters** (IDs `J1_Q1`…`J30_Q4`, 120 quarters in all, "Target: 120 Qtrs / month"). It is also inconsistent with itself:
- Settings says "4 Quarters (1.00 Juz)" right above "4 Quarters = 0.5 Juz • 8 Quarters = 1 Juz".
- The presets say "0.5 Juz (4 Qtrs)", while the plan builder says "4 Qtrs (1 Juz)".
- 29/10 shows "5/4 · 2 Juzzes revised".

The standard division is **30 juz → 60 hizb → 240 rub' al-hizb (8 quarters per juz)**, and that is what hifz students mean by "a quarter". **Recommendation for the clone: use 240 rub'** (and optionally the juz/hizb names and start ayahs from public Quran metadata), and make "Juz" vs "Quarter" maths come from one source of truth. This one decision is the biggest correctness win over the original.

## Screens

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Sign in | `/` signed out, Sign In tab | log in by username **or** email | Logo block, Tabs, TextInput with icon, PasswordInput (eye toggle), primary Button, link, demo-credentials box | empty, light, dark |
| S02 | Create account | `/` signed out, Create Account tab | register | name, username, email, password inputs; "Sign Up & Start Revise" | empty |
| S03 | Forgot password | S01 → "Forgot password?" | request a reset link, or enter a `RESET-XXXXX` code | TextInput, primary Button, inline code input + dark Button, "Back to Sign In" link | empty, light, dark |
| S04 | Home / Today: checklist | default after sign-in; top nav "Home / Today" → sub-tab "Today's Checklist" | log today's revision | AppHeader, TopNav, SubTabs, DateNavigator (‹ Today ›), GoalCard (badge, title "Today's Goal: Juz 1 (Alif-Lam-Meem)", progress bar %), GoalReached banner, QuarterCard grid (2 col desktop / 1 col mobile) with quality buttons, "auto-save" note, "Build Custom Plan →" link, footer links | partially done (2/4, 50%, "Halfway There!"), complete (4/4, 100%, "Alhamdulillah! Goal Reached"), past day ("Yesterday"), mobile. **Not seen:** empty day, no plan |
| S05 | Plan Builder & Target | S04 sub-tab, or Settings → Plan Builder | choose the daily target and the exact quarters for today, then lock the plan (hides other quarters for focus) | "Phase 1" card with current selection + "Lock Plan & Start Reading" (disabled until selection), TargetStepper (− 4 Qtrs +), preset Chips (2/4/8/12/16 Qtrs), Juz search, ALL / CLEAR, JuzAccordion ×30 (number badge, "0 of 4 Quarters Selected", 4 dots), QuarterSelect tiles | nothing selected. **Not seen:** selected, locked |
| S06 | Statistics | top nav "Statistics" | progress at a glance | DateNavigator, StatCard ×2 (This month: qtrs, ≈juz, "N days goal achieved"; Yearly total + monthly target), WeeklySummary (week of, weekly total, daily average), BarChart Mon–Sun with dashed goal line and clickable bars (jump to that day; selected bar highlighted), embedded HistoryList (same as S07) | filled (2 days of data) |
| S07 | Revision History | top nav "History" or header clock icon | browse, filter and open past days | Back button, summary chips (2 Days · 7 Qtrs · Top: Juz 1), search ("date or Juzz"), SegmentedFilter (All Days / Goal Achieved / Incomplete), DayRow (count/target badge, date, status "Target Met" / "Inbound progress (50%)", juz count, open → arrow, delete bin) | filled, row selected. **Not seen:** empty, no search results, delete confirm |
| S08 | Settings & Tools | header gear icon | configure | Back button, 4 tabs: **Target Config** (stepper + presets 0.25/0.5/1/2 Juz), **Plan Builder** (= S05), **Account** (full name, username, email, password masked + reveal + copy, UID, all with copy buttons; current target; "Reset Local Revision Logs", "View Firestore Security Rules"; "DEMO SANDBOX" badge), **Revision Tips** (3 static guideline cards); Sign Out (red) and Return Home buttons | each tab, filled |
| S09 | Backend & Schema panel | footer "View Firestore rules & schema" | developer showcase: DB model / state logic / rules code viewer | code tabs, copy button | **skip: not a product feature** |
| G | Global chrome | every signed-in screen | | AppHeader: logo, "Quran Dawr" + PRO badge, user email, streak pill (🔥 1 day), theme toggle, settings, history, sign-out icons; toast ("As-salamu alaykum! Successfully signed in."); footer: "Reset revision logs" + rules link | light, dark |

## Flows

```
F01 New user signs up and starts revising
    S02 create account -> S04 today
    happy path clicks: 1 tab + 4 fields + 1 submit = 2 clicks
    edge: username taken, email taken, weak password, duplicate sign-up

F02 Returning user signs in
    S01 -> S04 (toast)
    happy path clicks: 1 (submit)
    edge: wrong password, username vs email login, unknown user

F03 Log today's revision (core loop)
    S04 -> tap a quality (Good / Average / Needs Work) on each quarter card -> progress bar and badge update -> goal reached banner
    happy path clicks: 1 per quarter (4 for the default target)
    edge: change quality after checking, uncheck, exceed the target (5/4 seen), log on a past date, streak rollover at midnight / time zone

F04 Plan a custom day
    S04 "Build Custom Plan" or the S05 tab -> set target (preset or stepper) -> search/expand juz -> select quarters -> "Lock Plan & Start Reading" -> S04 shows only planned quarters
    happy path clicks: ~1 target + 1-2 expand + N quarter taps + 1 lock = about 7 for 4 quarters
    edge: selection < or > target, lock with nothing selected (button disabled), changing the plan after locking, plan for another date

F05 Review or edit a past day
    S04 date arrows ‹ › -> any date (labelled Today / Yesterday / date)
    or S06 click a chart bar -> that day
    or S07 row arrow -> that day
    happy path clicks: 1
    edge: future dates, days with no log

F06 Browse history
    S07 -> search / filter (All, Goal Achieved, Incomplete) -> open or delete a day
    happy path clicks: 1-2
    edge: delete confirmation and undo (not observed), empty results

F07 Change the default daily target
    header gear -> S08 Target Config -> preset or ± stepper (saves instantly)
    happy path clicks: 2

F08 Reset password
    S01 "Forgot password?" -> S03 -> submit username/email -> (email) -> enter RESET code -> new password
    happy path clicks: 3+ (the steps after sending were not observed)
    edge: unknown account, expired/invalid code

F09 Toggle theme       header sun/moon, 1 click, on every screen including signed-out ones
F10 Sign out           header icon or S08 red button, 1 click
F11 Reset all logs     footer / S08 "Reset Revision Logs" (destructive, not exercised)
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Button | primary (blue), dark, danger (red), light/inverse, ghost link, icon-circle | default, hover, disabled, active | all |
| TextInput | with leading icon, plain, password with eye toggle, code (monospace) | empty, focus, filled, error (assumed) | S01-S03, S05, S07 |
| Tabs / SegmentedControl | auth tabs (underline), top nav (pill, 3), sub-tabs (pill, 2), settings tabs (4, icon+label), history filter (3) | active, inactive | S01, S02, S04-S08 |
| AppHeader | — | with streak count | all signed-in |
| StreakPill | — | n days | header |
| Badge / Chip | PRO, status ("Halfway There!", "Goal Reached"), "DAILY FOCUS", quarter ID mono tag (`J1_Q1`), count chips | colour by status | S04, S06, S07 |
| DateNavigator | — | Today / Yesterday / dd/mm/yyyy | S04, S06 |
| GoalCard + ProgressBar | — | 0-99% (amber), 100% (green gradient) + celebration banner | S04 |
| QuarterCard | unchecked ("select quality to mark complete") / checked (green, struck-through juz title, quality badge, "change quality or uncheck") | Good / Average / Needs Work / none | S04 |
| QualityButtonGroup | Good (green), Average (amber), Needs Work (red), Uncheck (grey) | selected, unselected | S04 |
| TargetStepper | − value + | min/max (assumed 1..?) | S05, S08 |
| PresetChips | — | selected | S05, S08 |
| JuzAccordion + QuarterSelectTile | — | collapsed, expanded, n/4 selected (dots) | S05 |
| StatCard | — | — | S06 |
| WeeklyBarChart | bars, goal line, highlighted selected day | clickable | S06 |
| DayRow | goal met (amber trophy) / in progress (blue) | selected | S06, S07 |
| SettingsField | read-only with copy, password with reveal + copy | — | S08 |
| TipCard | — | — | S08 |
| Toast | success | auto-dismiss (assumed) | after sign-in |
| ThemeToggle | sun / moon | light, dark | global |

## Inferred data model

```
User        id, full_name, username (unique), email (unique), password_hash,
            daily_quarter_goal (int, default 4), plan_tier? (PRO badge), theme? (may be local only)
            evidence: S02 fields, S08 Account, schema panel (users.user_id, daily_quarter_goal)
            confidence: high (theme/plan: guess)

DailyLog    id = "<user_id>_<YYYY-MM-DD>", user_id, date (YYYY-MM-DD),
            completed_quarters: string[] (e.g. ["J1_Q1","J1_Q2"])
            quality per quarter: map quarter_id -> good | average | needs_work
            planned_quarters: string[] + plan_locked: bool
            target_for_day: int (snapshot, so changing the goal does not rewrite history)
            evidence: schema panel (id, user_id, date, completed_quarters), S04 quality badges,
                      S05 lock plan, S07 "5/4" per-day ratio
            confidence: high for the first four; quality / plan / target snapshot are inferred (medium) –
                        the schema shown does not list them

Quarter     (static reference data, not stored per user)
            id "J{juz}_Q{n}", juz (1-30), index (1-4 in the original; 1-8 recommended), label,
            juz_name (e.g. "Alif-Lam-Meem"), optional start surah:ayah
            evidence: S04/S05 labels and IDs
            confidence: high (structure), and see the domain note on 4 vs 8

PasswordReset  user_id, code ("RESET-XXXXX"), expires_at, used_at
            evidence: S03
            confidence: guess

Derived, not stored: streak (consecutive days with goal met or any log – rule unknown),
            monthly/yearly totals, weekly average, "goal achieved" day count, "Top Juz".
```

Relationships: User 1-n DailyLog; DailyLog n-n Quarter (via completed_quarters / planned_quarters); User 1-n PasswordReset.

## Feature matrix

See `features.csv`. Must: 14, should: 12, could: 6, skip: 4.

## Observed issues in the original (to beat, not copy)

- Inconsistent juz/quarter maths (see the domain note).
- The account page shows the **password**, with reveal and copy buttons. The clone stores hashes and never shows a password.
- On a 375px phone the header overflows (title wraps, icons cramped, horizontal scroll).
- A developer panel showing the DB schema and security rules sits in the footer for every user.
- "Today's Goal" keeps its title when viewing yesterday.
- Demo credentials are printed on the login page. The clone can offer a real "Try demo" button that seeds a sandbox instead.

## Out of scope (cannot or should not be cloned)

- The "Firestore rules & schema" developer panel (S09): a build showcase, not a feature.
- Showing or copying plaintext passwords: a security anti-pattern.
- Their users and their revision data.
- The PRO tier: there's no visible pricing or gating to study, so monetisation is our own design.
- Quran text itself: the original shows none. If the clone adds it, use a properly licensed or public-domain source (e.g. Tanzil text with attribution).

## Size

Screens 8 (+1 skipped), flows 11, entities 3 (+1 static reference table). Hard parts:
1. **Day boundaries and streaks.** Computing per-user local dates and time zones, the streak rule, and editing past days.
2. **Getting the Quran division data right.** 240 rub' with names and start points, one source of truth for the juz/quarter maths.
3. **Auth with username *or* email, plus password reset.** The email delivery and reset-code flow were not fully observed.

Also: instant autosave per tap (optimistic UI, offline-tolerant would be a plus), and charts.
Size: **S** (a weekend for a solid single-user version; closer to M if teacher/student sharing or offline sync is added).
