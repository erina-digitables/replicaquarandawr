# Build log

Stack as built: Next.js 15 (App Router, server actions) + Tailwind v4 tokens, in `web/`. Data goes through `web/src/lib/data/index.ts`. Today that is a **fake, file-backed layer** (`web/.data/dev-db.json`, gitignored) with the function signatures the Supabase layer will keep. Run with `npm --prefix web run dev`.

| ID | date | status | missing | harder than expected |
| --- | --- | --- | --- | --- |
| shell | 2026-10-30 | done | — | Quarter reference data: the quran.ai metadata stops at the hizb level, so the 240 quarter start points come from `quran-meta` (MIT), generated once into `web/src/data/quarters.json` and `replica/seed-quarters.sql`. Juz boundaries were cross-checked: 0 mismatches. |
| S04 Today | 2026-10-30 | done | Offline queue (could-have) | Choosing what to show when there is no plan: settled on "carry on after the last quarter finished on the previous active day". Past days with no log show an empty state instead of a guess. |
| S05 Plan | 2026-10-30 | done | — | Two-column tiles squeezed the labels, so tiles read Q1–Q8 (screen readers hear "Quarter 1"). The selection bar is sticky at the bottom. |
| S06 Progress | 2026-10-30 | done | — | Week bars for empty days were 4px tap targets; the whole column is now the button. |
| S07 History | 2026-10-30 | done | Pagination (fine at hundreds of rows) | The undo toast has to wait while hovered or focused. Hover is verified; focus could not be checked in the unfocused preview pane. Past days that missed the goal now say "Short of goal", not "In progress". |
| S08 Settings | 2026-10-30 | done | — | No password is ever shown (the original shows one). Delete account and reset logs need typed confirmation. |
| S01 Sign in | 2026-10-30 | done | — | — |
| S02 Create account | 2026-10-30 | done | — | Time zone is captured from the browser at sign-up and drives "today" on the server. |
| S03 Forgot password | 2026-10-30 | partial | **Real email.** In development the code is printed to the server log, and the screen says so. | — |

## Checks run

- Vertical slice in the browser: sign up → Today → rate → reload → rating kept.
- Plan → Start reading → checklist shows only the plan. Password reset with a wrong code (error), then the right code, then sign in by email.
- Demo account: streak, week total, month total and goal days match the seeded pattern.
- Every signed-in route at 390px (no overflow, 44px targets, labelled controls, one h1) and 1440px (centred 448px column, full header).
- Keyboard: Tab into a quarter's rating group, arrow key rates it, progress updates, focus ring visible.
- Light/dark: the header toggle persists across pages; "Match device" returns to the OS setting.
- No console errors on any screen. `tsc` and `eslint` clean.

## Not done yet (honest list)

- The fake data layer is single-process and file-based: fine for development, not for deployment. replica-backend swaps it for Supabase (`replica/schema.sql`, `replica/seed-quarters.sql`).
- Password-reset email (Resend) and the nightly demo-account purge (Vercel Cron) need the backend.
- No automated tests yet (`web/src/lib/dawr.ts` is pure and ready for unit tests in replica-test).
- Signed-out screens were checked by eye, not by the 390px script, because the script's iframe shares the signed-in session.
