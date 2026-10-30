# Test plan: Dawr

Build: 632c97c  Date: 2026-10-30  Env: local production build (`next build && next start`, port 3100), dev backend with its own empty data folder (`.data-e2e/`), Chromium 1440×900 and Pixel 7 at 390×844, browser time zone Asia/Karachi.

Run it: `npm run e2e` in `web/` (about 3 minutes). It never touches `npm run dev`, `.next/` or your dev data. The Supabase database rules have their own suite: `npm run db:test` (33 checks).

Every spec also fails on: any console error, any page error, any 5xx response. Every screen gets an axe scan (WCAG 2.0/2.1/2.2 A and AA).

Result of the last full run: **99 passed, 0 failed** (two runs in a row; crowd tests run alone after the rest).

| case | flow | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- | --- |
| F01-H1 | sign up | happy | fill 4 fields, Create account | Today, 4 quarter cards, email in header, no axe issues | e2e | pass |
| F01-E1 | | edge: empty input | submit empty | an error under every field, `aria-invalid`, nothing created | e2e | pass |
| F01-E2 | | negative: username taken | same username in capitals | "That username is taken.", typed values kept, password cleared | e2e | pass |
| F01-E3 | | negative: email taken | same email, capitals and spaces | "There's already an account with that email." | e2e | pass |
| F01-E4 | | negative: weak password, bad username | "short", "no spaces!" | both errors | e2e | pass |
| F01-E5 | | edge: long input, accents, emoji | 81-char name; "Zaynab Al-Ḥasanī 🌙" | 81 refused on the server; accents and emoji kept | e2e | pass |
| F01-E6 | | edge: double click submit | dblclick Create account | one account, lands on Today | e2e | pass |
| F01-E7 | | edge: many people, one hour | 6 people on 6 networks sign up | all 6 get in (BUG-001) | e2e @crowd | pass |
| F01-E10 | | edge: many demo visitors | 11 visitors start the sample | all 11 get in (BUG-001) | e2e @crowd | pass |
| F01-N1 | | negative: flood from one network | 14 sign-ups from one IP | later ones blocked | e2e @crowd | pass |
| F01-E8 | | edge: keyboard only | Tab through, Enter | signed up | e2e | pass |
| F01-E9 | | edge: time zone | browser in Pacific/Kiritimati (UTC+14) | Today shows that zone's date | e2e | pass |
| F02-H1 | sign in | happy | username + password | Today | e2e | pass |
| F02-H2 | | happy: email | email in capitals with spaces | Today | e2e | pass |
| F02-N1 | | negative: wrong password, unknown user | | same generic message for both, identifier kept | e2e | pass |
| F02-N2 | | negative: empty | submit empty | asks for both | e2e | pass |
| F02-N3 | | negative: brute force | 8 wrong tries, then the right one | "Too many tries" | e2e | pass |
| F02-E1 | | edge: signed out | open every app route | sent to sign in | e2e | pass |
| F02-E2 | | edge: expired / forged session | made-up session cookie | sent to sign in | e2e | pass |
| F02-E3 | | security: cookie | read `document.cookie` | session cookie is httpOnly, SameSite=Lax | e2e | pass |
| F03-H1 | log today | happy | rate 4 quarters | progress 4/4, "Goal met", kept after reload, streak 1 | e2e | pass |
| F03-E1 | | edge: change, uncheck | Good → Weak → Clear | kept after reload; cleared row removed | e2e | pass |
| F03-E2 | | edge: keyboard only | arrow keys in the rating group | rating moves and saves, focus stays (BUG-006) | e2e | pass |
| F03-E3 | | edge: double click | dblclick a rating | one row | e2e | pass |
| F03-E4 | | edge: two tabs | rate different quarters at once | both kept | e2e | pass |
| F03-E5 | | edge: future date | `?date=2099-01-01` | shows today, Next day disabled | e2e | pass |
| F03-E6 | | edge: malformed date | 4 bad values incl. SQL-ish text | shows today, nothing written | e2e | pass |
| F03-E7 | | edge: beyond goal | plan and rate 5 of 4 | "5 of 4", "beyond today's goal" | e2e | pass |
| F03-E8 | | edge: slow network | hold the save request | card is `aria-busy` and still operable, saved after (BUG-005) | e2e | pass |
| F03-N2 | | negative: offline | abort the save request | "Couldn't save" on the card and a toast; tapping again saves | e2e | pass |
| F03-E9 | | edge: dev backend, Windows | another process holds the data file open | every save still lands (BUG-002) | e2e @crowd | pass |
| F03-N1 | | security: second user | user B after user A rated | B sees nothing of A's | e2e | pass |
| F04-H1 | plan a day | happy | pick 2 quarters in juz 30, Start reading | checklist shows only those 2, plan-only banner | e2e | pass |
| F04-E1 | | edge: nothing picked | | Start reading disabled | e2e | pass |
| F04-E2 | | edge: search | "12", "juz 3", "rusul", "zzzz" | 1 match each; empty state | e2e | pass |
| F04-E3 | | edge: more than goal | 5 picked, goal 4 | "1 more than your goal" | e2e | pass |
| F04-E4 | | edge: change after locking | Edit plan, clear, Use suggestions | back to 4 suggested cards | e2e | pass |
| F04-E5 | | edge: preset from plan | 8 qtrs | goal 8, today follows (nothing rated) | e2e | pass |
| F04-E6 | | edge: plan another date | yesterday → Log this day | logged under yesterday | e2e | pass |
| F05-H1 | past day | happy | arrows | Yesterday / Today; Next disabled on today | e2e | pass |
| F05-H2 | | happy: chart | click a bar on Progress | opens that day | e2e | pass |
| F05-H3 | | data: sample stats | demo history | 12 days, 48 quarters, 10 goal days, streak 2, "Sample account" | e2e | pass |
| F06-H1 | history | happy | filter Goal met / Short, open a row | 12 / 10 / 2 rows, opens the day | e2e | pass |
| F06-E1 | | edge: search, empty result | "juz 1", "1999-01-01" | 2 rows; "No days match" | e2e | pass |
| F06-H2 | | happy: delete + undo | delete, Undo | day and its ratings back after reload | e2e | pass |
| F06-E2 | | edge: deleted record | delete, reload | stays deleted | e2e | pass |
| F07-H1 | daily target | happy | gear → 8 qtrs | saved, 8 cards today | e2e | pass |
| F07-E1 | | edge: keyboard, bounds | Home / End / PageDown | 1, 240, 232; minus disabled at 1 | e2e | pass |
| F07-E2 | | edge: snapshot | change goal after rating | started day keeps 4 | e2e | pass |
| F08-H1 | reset password | happy | code by username, wrong then right (pasted "123 456") | wrong refused; right works; old password fails; identifier not in URL | e2e | pass |
| F08-H2 | | security | reset from another browser | the first browser is signed out | e2e | pass |
| F08-N1 | | negative: unknown account | | same screen as a real account, code refused | e2e | pass |
| F08-N2 | | negative: format | 5-digit code, short password | both caught | e2e | pass |
| F08-N3 | | security: guessing | 5 wrong codes, then the right one | still refused | e2e | pass |
| F08-E1 | | edge: arriving with a code | "I already have a code" | asks who it is for | e2e | pass |
| F09-H1 | theme | happy | header toggle, reload | dark kept, no axe issues in dark | e2e | pass |
| F09-H2 | | edge: match device | OS dark, Light, Match device | follows the OS again | e2e | pass |
| F09-E1 | | edge: signed out | toggle on sign-in | works | e2e | pass |
| F10-H1 | sign out | happy | header icon | sign-in screen | e2e | pass |
| F10-H2 | | happy: phone route | Settings → Sign out | sign-in screen | e2e | pass |
| F10-E1 | | edge: back button | Back after sign out | still signed out | e2e | pass |
| F11-H1 | reset all logs | happy + negative | "reset", then "RESET" | refused, then history empty | e2e | pass |
| F11-H2 | delete account | happy + negative | wrong name, then the username | refused; then user, logs and sessions gone | e2e | pass |
| S08-H1 | account | happy | change username, sign in with it | works | e2e | pass |
| S08-N1 | | negative | wrong current password, then right | refused, then changed | e2e | pass |
| S08-E1 | | security | look for the password | never on the page | e2e | pass |
| A11Y | every screen | a11y + layout | 5 signed-out, 7 signed-in × light/dark × 1440/390, loading skeleton, 404 | 0 axe violations, no sideways scroll, one h1, every control named | e2e | pass |
| DB | Supabase rules | security | `npm run db:test` | 33 checks incl. second user sees nothing | script | pass |

## Manual pass (cannot be automated here)

| case | what | status |
| --- | --- | --- |
| M1 | confirmation and reset emails arrive from your domain, links and codes work | **blocked**: needs your Supabase + Resend keys (see `backend.md` live checks) |
| M2 | anonymous sign-in, RLS and the purge cron on real Supabase | **blocked**: same |
| M3 | real screen reader (NVDA on Windows, VoiceOver on iPhone) through F03 | **to do by you**: automated checks cover names, roles and focus, not the spoken experience |
| M4 | visual check, light and dark, 390 and 1440 | done: screenshots in `replica/test-screens/`, looked at by eye |
| M5 | a real phone: touch targets, the sticky plan bar over the keyboard | **to do by you** |
| — | OAuth, payments | not in this app |
