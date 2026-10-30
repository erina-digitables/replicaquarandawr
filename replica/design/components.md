# Components: Dawr tracker

Built from the recon component list (`replica/recon.md`). Tokens: `tokens.json` → `tokens.css` + `tailwind.css`. Components use role utilities only (`bg-surface`, `text-text-muted`, `border-border-input`), never hex.

Global rules:
- **Focus:** every interactive element shows `focus-visible` as a 2px `focus` ring with a 2px offset in `bg`. The ring is never removed.
- **Tap targets:** at least 44px tall on touch, including chips, quality buttons and icon buttons. The original's 30px quality buttons and 10px labels are the main thing this system fixes.
- **Text:** minimum 12px (`xs`). Uppercase labels are `xs/600` with 0.04em tracking, never smaller.
- **Icons:** Lucide (ISC licence), 16px inline and 20px in icon buttons, `stroke-width 2`. None of the original's icons or emoji are reused. Decorative icons get `aria-hidden`.
- **Motion:** `fast` for hover and press, `base` for progress fills and panel changes. All of it is turned off under `prefers-reduced-motion`.
- **Copy:** written fresh. The labels below are ours, not the original's.

---

```
Button
  variants  primary (accent), secondary (surface + border), ghost (text only), danger (solid-danger)
  sizes     sm 36px (hit area padded to 44px), md 44px, lg 52px (full-width on auth screens)
  states    default, hover (accent-hover / surface-2), active (scale .98), focus-visible, disabled (50% opacity, no pointer), loading (spinner replaces icon, label stays)
  tokens    radius md, font sm/700, gap 8, padding-x 16
  a11y      real <button type>, aria-busy while loading, disabled buttons stay focusable only if they explain why (aria-describedby)
  used on   S01, S02, S03, S05, S08
```

```
IconButton
  variants  neutral (surface-2 bg, text-muted icon), active (highlight icon on highlight-soft)
  sizes     44px circle (40px visual inside a 44px hit area)
  states    default, hover, focus-visible, active (aria-current/aria-pressed)
  a11y      aria-label required (e.g. "Settings", "History", "Sign out", "Switch to dark theme")
  used on   AppHeader, DateNavigator
```

```
TextField
  variants  plain, with leading icon, password (show/hide toggle), code (mono, uppercase, letter-spaced)
  sizes     md 44px
  states    empty, focus (focus ring), filled, error (danger border + message below), disabled
  tokens    bg surface-2, border border-input 1px, radius md, text base (16px, so iOS does not zoom)
  a11y      visible <label> above (never placeholder-only), aria-invalid + aria-describedby on error, show/hide toggle is a button with aria-pressed and label "Show password"
  used on   S01, S02, S03, S05 (search), S07 (search)
```

```
Tabs (SegmentedControl)
  variants  underline (auth: Sign in / Create account), track (top nav 3, sub-tabs 2, settings 4, history filter 3)
  states    selected (surface on surface-2 track, text, 1px border), unselected (text-muted), hover, focus-visible
  tokens    track bg surface-2, radius lg, item radius md, font sm/700
  a11y      tablist/tab/tabpanel with roving tabindex and arrow keys, for in-page panels. Top nav uses links with aria-current="page", not tabs, because they are routes
  used on   S01/S02, S04-S08
```

```
AppHeader
  parts     logo mark (own), app name, account email (truncated), StreakPill, IconButtons: theme, history, settings, sign out
  layout    one row. Below 768px only logo, name, streak, theme and settings show (history is in the top nav, sign out in Settings) and the email hides. Checked at 375px: last icon ends 13px inside the header, no page overflow (the original overflows)
  tokens    bg surface, border border, radius xl, height 64
  a11y      <header> landmark, logo links to /today
  used on   every signed-in screen
```

```
StreakPill
  states    0 days (text-muted, flame outline), n days (highlight on highlight-soft), at risk today (dashed border + tooltip "Finish today to keep it")
  a11y      text reads "Streak: 5 days", not just the number
  used on   AppHeader
```

```
Badge / Chip
  variants  status (success | warning | danger | accent | neutral, using the *-soft bg with role text), code tag (mono xs on surface-2), count chip (neutral)
  sizes     24px tall, padding-x 8, radius pill (status) or sm (code)
  a11y      colour never carries meaning alone: every status badge has a word ("Goal met", "In progress")
  used on   S04, S06, S07, S08
```

```
DateNavigator
  parts     prev IconButton, label ("Today", "Yesterday", or weekday + date), date in mono text-muted, next IconButton
  states    next disabled on today (no logging the future), focus-visible
  a11y      buttons labelled "Previous day" / "Next day". The label is an aria-live polite region, so screen readers hear the new date
  used on   S04, S06
```

```
GoalCard + ProgressBar
  parts     eyebrow badge, title (display lg: "Today: Juz 3, quarters 5-8"), target line, ProgressBar, celebration panel at 100%
  states    0% (empty track), in progress (accent fill), met (success fill + panel), over target (shows "6 of 4", bar stays full)
  tokens    card bg surface, radius xl, padding 24. Bar height 8, track surface-2, radius pill, fill transition base
  a11y      role="progressbar" aria-valuenow/max, aria-valuetext "2 of 4 quarters". Celebration panel is role="status"
  used on   S04
```

```
QuarterCard
  parts     check circle, juz + quarter title, start reference (surah:ayah), code tag, QualityButtonGroup
  states    not done (surface, border), done (success-soft bg, success border, check filled solid-success, title not struck through), saving (spinner in the check circle), error (danger border + "Couldn't save. Tap to retry")
  tokens    radius md, padding 16, always one column (two columns in a 480px column made the titles wrap to 3 lines and squeezed the quality buttons; checked on /design)
  a11y      the card is a <fieldset> with <legend> = quarter title. Quality choices are a radio group (see below). No nested buttons
  used on   S04
```

```
QualityButtonGroup
  variants  Good (solid-success when selected), Okay (solid-warning), Weak (solid-danger); Clear (ghost, only when one is selected)
  states    unselected (surface, role-coloured text and border), selected (solid fill, on-solid text, check icon), focus-visible, disabled while saving
  sizes     44px tall, equal width, gap 8
  a11y      role="radiogroup" aria-label="How did <quarter> go?". Each option is role="radio" aria-checked, arrow keys move. Selecting marks the quarter done. "Clear" is a separate button
  used on   S04
```

```
TargetStepper
  parts     − IconButton, value ("4 quarters", mono), + IconButton, juz equivalent below ("= half a juz")
  states    min 1 (− disabled), max 240 (+ disabled), focus-visible
  a11y      role="spinbutton" with aria-valuenow/min/max and aria-valuetext "4 quarters, half a juz". Up/Down arrows change it, PageUp/PageDown by 8
  used on   S05, S08
```

```
PresetChips
  options   2, 4, 8, 16 quarters (¼, ½, 1, 2 juz). The juz maths always comes from 8 quarters per juz
  states    selected (accent bg, on-accent), unselected (surface-2), focus-visible
  a11y      radiogroup, synced with TargetStepper
  used on   S05, S08
```

```
JuzAccordion + QuarterSelectTile
  parts     header: juz number badge, juz name, "2 of 8 selected", 8 dots, chevron. Body: 8 tiles in a 2/4-col grid
  states    collapsed, expanded, some selected (dots filled accent), all selected
  a11y      header is a <button aria-expanded aria-controls>. Tiles are checkboxes with visible labels. A "Select all 8" checkbox per juz
  used on   S05
```

```
SelectionBar (plan builder footer)
  parts     "6 quarters picked" summary, primary "Start reading" button
  states    nothing picked (button disabled with hint), picked, locked (shows "Plan locked" + "Edit plan")
  layout    sticky at the bottom on mobile, inline on desktop
  a11y      summary is aria-live polite
  used on   S05
```

```
StatCard
  parts     label (xs uppercase text-muted), value (display xl), sub-line (sm text-muted), icon
  tokens    bg surface, radius lg, padding 16
  used on   S06
```

```
WeeklyBarChart
  parts     7 bars Mon-Sun, dashed goal line, day labels, selected-day highlight
  states    bar under goal (accent), bar at/over goal (solid-success), selected (2px focus outline), empty day (4px stub; the whole column is the button, so it is still easy to tap)
  a11y      each bar is a <button aria-label="Thursday 29 October: 5 quarters, goal met">. A visually hidden table carries the same data. The chart is not canvas
  used on   S06
```

```
DayRow
  parts     ratio badge ("5/4"), date, status badge, juz summary, open chevron, delete IconButton
  states    goal met, in progress, selected, deleting (row collapses, Undo toast appears)
  a11y      the row is a link to /today?date=…, and delete is a separate button outside the link with aria-label "Delete log for 29 October"
  used on   S06, S07
```

```
SettingsField
  variants  read-only with copy button, editable (inline edit → Save / Cancel)
  states    default, editing, saving, saved (check for 2s), error
  a11y      copy button announces "Copied" via a live region
  note      there is no password field. Passwords are changed in a "Change password" flow that never shows the current one
  used on   S08
```

```
TipCard
  parts     icon, title, body
  used on   S08 Tips
```

```
Toast
  variants  success, error, undo (has an action button)
  states    enter, visible 4s (undo: 6s), leaving. Pauses while hovered or focused
  a11y      region role="status" (error: role="alert"). Never the only place an error is shown
  used on   global (sign-in welcome, saved, deleted + undo)
```

```
EmptyState
  parts     icon, one-line title, one-line help, optional primary action
  instances no logs yet (History: "Your first day will show up here"), no plan (Today: suggested quarters + "Plan my day"), no search results
  used on   S04, S06, S07 (none of these were seen in the original. The clone needs them all)
```

```
ConfirmDialog
  variants  destructive (Reset all logs: type RESET to confirm), simple (Sign out of every device)
  a11y      native <dialog> or Radix Dialog: focus trap, Esc closes, focus returns to the trigger, title + description wired with aria-labelledby/-describedby
  used on   S08
```

```
ThemeToggle
  states    system, light, dark (3-way menu in Settings; the header button flips light/dark)
  behaviour sets data-theme on <html>, stored on the profile and in a cookie so the first paint is right (no flash)
  used on   AppHeader, S01-S03
```

## Layout

- **Single column**, `max-width: 480px`, 16px gutters, centred, on every breakpoint (the core loop is one-handed). At ≥768px the Statistics and Plan screens may widen to 720px with 2-column cards.
- **Vertical rhythm:** 16px between cards, 24px card padding, 12px inside groups.
- **Header** is 64px tall and sits in the flow (not fixed). The bottom SelectionBar on S05 is the only sticky element.

## Primitives built

See `web/src/app/design/page.tsx`, a `/design` route that renders every primitive and its states in light and dark side by side. Components live in `web/src/components/ui/`. Screenshots of the check are in `replica/design/screens/`.

Run it with `npm --prefix web run dev` and open http://localhost:3000/design. After any token change, run `node replica/design/build-tokens.mjs` (it also refreshes `web/src/styles/`) and then the contrast check.

Not yet built as primitives (spec only): ConfirmDialog, SettingsField, TipCard, ThemeToggle menu, SelectionBar. They are simple compositions of the parts above and get built with their screens.
