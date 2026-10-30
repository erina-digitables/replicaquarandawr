# Backend: Dawr

Status 2026-10-30: **code complete, not yet run against a real Supabase project.** No Supabase, Resend or Vercel account exists yet. You create those (Claude never signs up for services or handles live keys). Until then the app runs on the file-based dev backend, which uses the same interface.

## How it fits together

| piece | where | notes |
| --- | --- | --- |
| Backend interface | `web/src/lib/data/backend.ts` | the only thing screens and actions call |
| Dev backend | `web/src/lib/data/fake.ts` | JSON file in `web/.data/`; used when Supabase vars are absent; refuses to run in a production build unless `DAWR_ALLOW_FAKE_BACKEND=1` |
| Supabase backend | `web/src/lib/data/supabase.ts` | reads as the user (RLS), writes through database functions, service role only for username lookup, rate limits, account deletion, cron |
| Clients | `web/src/lib/supabase/clients.ts` | server-only; auth cookies forced `httpOnly`, `SameSite=Lax`, `Secure` in production |
| Session refresh | `web/src/middleware.ts` | refreshes tokens before rendering; no-op on the dev backend |
| Migrations | `web/supabase/migrations/` | `…001_schema` (tables, RLS, view, streak, username lookup, profile trigger), `…002_quarters` (240 rows), `…003_functions` (write functions, rate limits, job log) |
| Migration tests | `web/supabase/tests/migrations.test.mjs` | `npm run db:test`: every migration on embedded Postgres; 33 checks |
| Auth config + emails | `web/supabase/config.toml`, `web/supabase/templates/` | pushed with `npm run db:config` |
| Email confirm | `web/src/app/auth/confirm/route.ts` | token-hash link from the confirmation email |
| Cron | `web/src/app/api/cron/purge-demo/route.ts`, `web/vercel.json` | 03:00 UTC daily; bearer `CRON_SECRET`; every run logged in `job_runs` |
| Seed | `web/scripts/seed.mjs` | `npm run db:seed`: two invented accounts on `example.test` |
| Env | `web/.env.example` | every variable, no values |

## Your setup steps (in order)

1. **Supabase**: create a project (free tier is fine). Copy the URL, anon key and service-role key into `web/.env.local` as named in `.env.example`. Set `SITE_URL=http://localhost:3000`.
2. **Resend**: create an account, verify a domain you own, create an API key. Put `RESEND_API_KEY` and `EMAIL_FROM` in `.env.local`.
3. From `web/`: `npm run db:link` (choose the project), then `npm run db:push` (migrations), then `npm run db:config` (auth settings, email templates, SMTP).
4. In the Supabase dashboard, check: Auth → Providers → Email (confirm email **on**), Auth → Settings → **anonymous sign-ins on**, Auth → Emails shows the new templates, Database → Backups (daily backups are on for paid plans; on free, see note below).
5. Optional: `SEED_PASSWORD=… npm run db:seed` for two sample accounts.
6. Restart `npm run dev`. The app switches to Supabase automatically. Then tell Claude, and it will run the live checks below.

## Live checks still to run (need step 6)

- [ ] sign up → confirmation email arrives from your domain → link signs you in
- [ ] sign in by username and by email; wrong password shows the generic error
- [ ] reset: code email arrives, wrong code rejected, right code sets the password and signs out other sessions
- [ ] demo: anonymous sign-in seeds 13 days; header says "Sample account"
- [ ] rate, plan, delete + undo, reset logs, delete account against the real database
- [ ] second real user sees none of the first user's data (already proven on the migrations in `db:test`)
- [ ] cron route returns 401 without the secret and logs a run with it

## Auth

- Email + password sign-up **with verification** (confirm link), sign-in by **username or email** (username resolved server-side by the service role; the browser can't enumerate usernames).
- Password reset by **6-digit code** (Supabase recovery OTP, our template shows `{{ .Token }}`). Afterwards **every session is signed out** (`signOut({ scope: "global" })`).
- Change password checks the current one on a cookie-less client first.
- Sessions: http-only cookies, refreshed in middleware. Sign out ends the local session; reset signs out everywhere.
- **Account deletion actually deletes**: `auth.admin.deleteUser` cascades to profile, logs and quarters (tested in `db:test`).
- No OAuth and no magic link: the original has neither. No roles or teams: single-user data only.

## Database

- Migrations checked in and run by script (`db:push`).
- **Row level security on every table**; `job_runs` and `rate_limits` have RLS with no policies (service role only). Write paths are `security invoker` functions, so RLS still applies.
- Second-user test: user B sees no logs, quarters or summaries, sees only their own profile, cannot insert into or delete A's rows, cannot call the username lookup, rate limits or job log. Anon cannot call write functions.
- Seed script with invented people.
- **Backups**: Supabase's free plan has no automatic daily backups (Pro has 7 days). Before real users arrive: upgrade, or schedule `pg_dump`. **Not done; your decision.**

## Payments

None. The PRO tier is `skip` in the feature matrix (no pricing to study). If replica-entrepreneur prices a plan, add Stripe Checkout + Customer Portal then.

## Email and jobs

- Transactional email: Supabase Auth over **Resend SMTP** from your own domain; both templates written fresh (`supabase/templates/`).
- Jobs: `purge-demo` (Vercel Cron, 03:00 UTC). Each user delete is retried once; failed IDs and errors stay in `job_runs` (the dead-letter record).
- No reminders yet (not in the original). Times are stored in UTC and shown in the user's time zone.

## Integrations

None beyond the above. The Quran data is static (quran-meta, MIT), bundled at build time, no API calls.

## Security checklist

- [x] secrets only in env vars; `.env*` ignored (except `.env.example`); no `NEXT_PUBLIC_` keys; the Supabase clients are only imported by server code
- [x] input validated on the server with zod on every server action and route (`web/src/lib/validation.ts`)
- [x] authorisation on every read and write: RLS plus `user_id` filters; tested with a second user (`npm run db:test`)
- [x] rate limits in the database (hashed keys): sign-in 8/10 min per identifier, sign-up 5/h, reset 3/15 min, reset-code 5/15 min, demo 10/h, password change 5/15 min, plus a per-IP limit at 4× each
- [x] webhooks verify signatures: no inbound webhooks; the cron endpoint requires a bearer secret
- [x] uploads: none
- [x] no user data in URLs or logs: the reset flow keeps the identifier in an http-only cookie (it used to be `?for=` in the URL); the dev backend logs the code, never the address; rate-limit keys are SHA-256 hashed
- [x] dependencies audited: `npm audit` reports **0 vulnerabilities** (2026-10-30). Upgraded Next.js 15.5.4 → 15.5.28 (critical RCE/DoS/SSRF advisories), zod 3 → 4.6.7 (high), sharp via `npm audit fix`. Next 15 pins PostCSS 8.4.31, which has open advisories fixed only in Next 16, so `package.json` `overrides` lifts that nested copy to ^8.5.32 (the same line Tailwind uses). Remove the override when moving to Next 16. Checked after the upgrade: `tsc`, lint, `db:test`, `next build`, and rate → reload → delete → undo in the app.
- [x] privacy page lists every processor (Supabase, Vercel, Resend): `/privacy`, linked from the footer. Needs the operator's name and contact before launch.

## Known gaps

- Not yet run against a real Supabase project (see the live checks).
- Fixed during the upgrade: History undo validated `completedAt` as UTC-only ("Z"), but Postgres returns "+00:00", so undo would have failed on Supabase. It now accepts offsets.
- The dev backend's rate limiter is per-process; fine for development only.
- Supabase also rate-limits auth emails per hour on its side (`config.toml` sets 30).
