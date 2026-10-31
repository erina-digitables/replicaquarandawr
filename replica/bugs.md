# Bugs

Found by `/replica-test` on 2026-10-30. Every bug below was reproduced by a failing test first, then fixed, and the test is kept. Summary: **12 found, 9 fixed, 3 open.** By severity: S1 ×2, S2 ×3, S3 ×4, S4 ×3. Open: BUG-010 (S2, partly fixed, re-check on the real server), BUG-008 and BUG-009 (S4). BUG-010 to BUG-012 came from running the suite on Postgres (2026-10-31).

### BUG-001: Sign-up and the sample account were capped for the whole app, not per visitor

- Severity: S1 (core flow blocked: after 5 sign-ups in an hour, nobody anywhere could create an account)
- Flow / case: F01 / F01-E7, F01-E10
- Screen: S02, S01
- Build: 892b1f3  Browser / device: Chromium 141, 1440px

Steps
1. Six different people, on six different networks, open /signup within the same hour.
2. Each fills in valid details and presses Create account.

Expected: all six get an account.
Actual: from the sixth on, everyone gets "Too many new accounts from here. Try again later." The sample account had the same cap at 10 an hour.
Evidence: F01-E7 failed at "person 3 of 6" (the parallel tests had used up the shared allowance), F01-E10 at "visitor 11 of 11". The first full run had 69 failures, nearly all of them this.
Suspected cause: `allowed("signup", "any", …)` used the constant `"any"` as the rate-limit subject, so every visitor shared one bucket.
Status: fixed in 632c97c. Sign-up is now limited per email (3/h) and per network (12/h); the sample account per network (10/h). F01-N1 checks that one network still can't flood.

### BUG-006: Rating by keyboard lost focus after each change (regression, never shipped)

- Severity: S2 (keyboard users lose their place after every rating, no workaround but the mouse)
- Flow / case: F03 / F03-E2
- Screen: S04

Steps
1. Tab into a quarter's rating group, press the right arrow.

Expected: the rating changes and focus stays on it, so the next arrow keeps working.
Actual: focus dropped to the page body while it saved.
Evidence: F03-E2 failed on desktop and mobile with `toBeFocused` "inactive" on a `disabled` radio.
Suspected cause: the first fix for BUG-005 disabled the buttons while saving, and a disabled element loses focus.
Status: fixed in 632c97c before it was ever committed: the group is now `aria-busy` while saving and stays operable.

### BUG-002: Dev backend: saves fail with a 500 on Windows when another program has the data file open

- Severity: S3 (development only; Supabase builds are not affected)
- Flow / case: F03 / F03-E9
- Screen: S04 (any save)

Steps
1. Run `npm run dev` on Windows with no Supabase keys.
2. Open `web/.data/dev-db.json` in a program that keeps it open (or let antivirus scan it), and rate a quarter.

Expected: the rating saves.
Actual: `EPERM: operation not permitted, rename …dev-db.json.tmp -> dev-db.json`, a 500, and the rating is lost.
Evidence: F03-E9 (a reader holding the file open) failed with 500s; the server log showed the EPERM.
Suspected cause: Windows refuses to replace a file that another process has open.
Status: fixed in 632c97c: the write retries for up to about a second on EPERM/EBUSY/EACCES.

### BUG-003: Pasting a reset code with a space cuts off the last digit

- Severity: S3 (workaround: type the code)
- Flow / case: F08 / F08-H1
- Screen: S03 (Enter your code)

Steps
1. Request a reset code.
2. Paste it as "123 456" (how many people copy a spaced code) into Code, set a new password, submit.

Expected: accepted; the server already strips spaces.
Actual: the field held only "123 45", so "The code is 6 digits."
Evidence: F08-H1 failure snapshot: `textbox "Code" [invalid]`, "The code is 6 digits."
Suspected cause: `maxLength={6}` on the input.
Status: fixed in 632c97c (`maxLength={9}`; the server still requires exactly 6 digits).

### BUG-004: The loading skeleton's label was invisible to screen readers

- Severity: S3 (screen reader users get silence while a screen loads)
- Flow / case: every signed-in screen / A11Y "loading skeleton", F07-H1
- Screen: all signed-in screens while loading

Steps
1. On a slow connection, move from Today to History.

Expected: the skeleton is announced as loading.
Actual: axe `aria-prohibited-attr` on `div[aria-label="Loading"]`: an aria-label on a div with no role is ignored.
Evidence: F07-H1 axe scan caught the skeleton mid-navigation; the dedicated skeleton test failed.
Status: fixed in 632c97c (`role="status"`).

### BUG-005: The saving spinner on a quarter card never appeared

- Severity: S3 (on a slow connection there was no sign a tap was still saving, so nothing warned against leaving the page too soon)
- Flow / case: F03 / F03-E8
- Screen: S04

Steps
1. On a slow connection, tap Good on a quarter.

Expected: the card shows it is saving until the server answers.
Actual: no saving state at any point.
Evidence: F03-E8 (save request held) failed: the card never showed it was saving.
Suspected cause: the saving flag was ordinary state set inside a React transition, so it only rendered after the save had finished.
Status: fixed in 632c97c: the saving set is now `useOptimistic`, so it shows immediately and clears when the save lands.

### BUG-007: Dev backend: the sample account showed an invented email in the header

- Severity: S4 (development only; on Supabase the sample account has no email)
- Flow / case: F05 / F05-H3
- Screen: header

Steps
1. Without Supabase keys, press "Try it with sample data" and look at the header at desktop width.

Expected: "Sample account".
Actual: `demo_1a2b3c4d@demo.invalid`.
Evidence: F05-H3 failed on `getByText("Sample account")`.
Status: fixed in 632c97c (the header checks `isDemo`, not just a missing email).

### BUG-008: Header label is cut off at desktop width even when it is short

- Severity: S4 (cosmetic)
- Flow / case: M4 visual pass
- Screen: header, 1440px

Steps
1. Sign in (or start the sample) and look at the header at 1440px.

Expected: "Sample account" or a normal-length email fits; the header column has room.
Actual: "Sample ac…". The five round icon buttons leave the label about 70px.
Evidence: `replica/test-screens/1440-light-history.png`, `1440-dark-stats.png`.
Status: open. Fix with replica-brand's header pass: drop the email line to a tooltip/Settings, or let the column widen on desktop.

### BUG-009: In dark mode, the bars for days short of the goal are near-white

- Severity: S4 (cosmetic: the unfinished days are louder than the finished ones)
- Flow / case: M4 visual pass
- Screen: S06 Progress chart, dark theme

Steps
1. Dark theme, open Progress in a week with a short day.

Expected: short days quieter than goal-met days.
Actual: short days use `accent`, which is the near-white neutral placeholder in dark mode.
Evidence: `replica/test-screens/1440-dark-stats.png` (Wed, Sat).
Status: open, on purpose: `accent` is a placeholder until replica-brand sets the real colour. Re-check this chart then.

## Found while adding the Postgres backend (2026-10-31)

Not yet committed; the fixes below are in the working tree.

### BUG-011: Username sign-in and reset by username failed on Postgres

- Severity: S1 (core flow blocked on the new backend; never shipped)
- Flow / case: F02 / F02-H1, F08-H1 under `npm run e2e:postgres`
- Actual: a 500, `function email_for_username(text) does not exist`. The function takes `citext` and the query passed plain text.
- Status: fixed (explicit `::citext` cast). 12 tests went from fail to pass.

### BUG-012: A database created in a non-UTF-8 encoding refuses accented names and emoji

- Severity: S2 (on a misconfigured server, sign-up with "Zaynab Al-Ḥasanī 🌙" fails with a 500)
- Flow / case: F01-E5 under `npm run e2e:postgres`
- Actual: `character with byte sequence 0xe1 0xb8 0xa4 in encoding "UTF8" has no equivalent in encoding "WIN1252"`. The local test database had picked up Windows' default encoding.
- Status: fixed three ways: the first migration now refuses to run on a non-UTF-8 database (with the command to fix it), `vultr.md` step 2.4 creates the database with `encoding 'UTF8'`, and the local test database is initialised as UTF-8.

### BUG-010: With a near-instant server reply, a form or rating can stay "saving" forever

- Severity: S2 (the save itself lands; the screen doesn't catch up until a reload. Sign-up can look stuck after the account was created, so a second press says the username is taken)
- Flow / case: F03-E1/E3/E4/E7 and F01 sign-up, intermittently, under `npm run e2e:postgres` only
- Steps: on the Postgres backend at localhost speed (replies in ~15 ms), sign up or rate a quarter, repeatedly.
- Expected: the busy state clears when the reply arrives.
- Actual: in roughly 1 run in 5 the reply arrives complete (the server action's result is `undefined`, no error), but React keeps the transition open, so anything tied to it (`useOptimistic`, `useActionState`'s pending flag) never clears. Not seen with 100 ms of simulated network latency (24 of 24 passed), and never on the dev backend (99 of 99, and 36 of 36 in a loop).
- Evidence: per-run request logs; every database transaction that started also finished; the action's promise resolved (`saved 1` logged in the browser); Next's router never consumed the reply.
- Suspected cause: a race inside Next's client router when an action reply lands very fast. Not found in Next's issue tracker.
- Status: **partly fixed, still open.** The Today board no longer depends on the transition for its saving indicator (plain state, set before the transition and cleared when the save settles), so ratings recover. Forms using `useActionState` (sign-up, sign-in, reset) can still show it. **Re-check on the real server**, where every reply crosses the network: if it never appears there, downgrade to S4.

## To check (not reproduced, or not reproducible here)

- **Client IP for rate limits.** Changed 2026-10-31: `clientIp()` now takes the *last* `x-forwarded-for` value (the one our own proxy adds), and `deploy/Caddyfile` overwrites the header with the real visitor address. Check on the server that a made-up `X-Forwarded-For` doesn't change which limit bucket you land in.
- **"failed to get redirect response … ECONNRESET".** Seen in `next start` only while the dev backend's event loop was blocked by the file-lock stress test (now isolated). Not reproduced since. Watch the logs on the first Vercel preview.
- **Everything that needs live keys** (M1, M2 in `test-plan.md`): email arrival, confirm links, anonymous sign-in, RLS against the real project, the purge cron.
- **Dev backend hashes passwords synchronously** (scrypt in one process). Fine for one developer; the suite needs generous timeouts because of it. Not a production path.
