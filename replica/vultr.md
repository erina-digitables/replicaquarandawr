# Moving Dawr to your Vultr server

Everything runs on your one Ubuntu server: PostgreSQL, the app, and nginx in front of it for HTTPS. Email still goes through Resend, since a server can't reliably send mail that lands in inboxes on its own.

**This server (nazira-server, 45.63.100.246, Ubuntu 26.10) already hosts two live sites** behind nginx with certbot certificates: tahiracademytrust.org (static) and hifzapp.link (a Node app on port 3001, run by the `ameen` user). Dawr joins them as a third nginx site at **dawr.hifzapp.link** and touches neither. That is why this guide uses the existing nginx and certbot instead of Caddy, and port 3000 for the app.

```
browser ──HTTPS──> nginx (:443) ──> Next.js app (:3000, localhost only) ──> PostgreSQL (:5432, localhost only)
                                              └──> Resend API (confirmation + reset emails)
cron (nightly) ──> purge old sample accounts, back up the database
```

Who does what: **you** run everything on the server and in the Vultr, DNS and Resend dashboards; **Claude** writes the code and config and never sees a password, key or connection string. Where a step makes a secret, you put it straight into a file on the server.

---

## Part 1: code changes (Claude, on this machine)

**Status: committed in 455b30e (2026-10-31); Caddy swapped for nginx 2026-11-01.** Postgres suite 94 of 95 run (the one failure was a test race, fixed). One open issue to re-check on the real server: BUG-010 in `bugs.md`.

Nothing below touches the screens. The app already talks to storage through one `Backend` interface (`web/src/lib/data/backend.ts`); this adds a third one.

1. **A small `auth` schema for plain Postgres.** The existing migrations expect Supabase's `auth.users` table and `auth.uid()` function. A new first migration creates both: a `users` table (email, password hash, confirmed time) and `auth.uid()` reading the signed-in user from the current transaction. Result: the three existing migrations and every row security rule run **unchanged**, and `npm run db:test` keeps checking that a second user sees nothing.
2. **`web/src/lib/data/postgres.ts`**, the new backend, using `pg` (node-postgres) and a connection pool. Each request runs in a transaction that sets the user first, so the database itself refuses other people's rows. The app connects as a role that is **not** the table owner, so those rules can't be skipped.
3. **Our own sign-in**, moved from the dev backend onto Postgres tables: hashed passwords (scrypt, without blocking the server), sessions in httpOnly secure cookies, reset codes, rate limits, sign out everywhere on password reset. Sign-up and reset emails are sent through Resend with the existing templates.
4. **Backend choice** in `web/src/lib/data/index.ts`: `DATABASE_URL` set → Postgres. Supabase stays as an option.
5. **Client IP fix** (`bugs.md` "to check"): behind nginx, the app trusts only the address nginx sets, so the per-network rate limits can't be dodged with a fake header.
6. **Deploy files** in `deploy/`: a migration runner (`npm run db:migrate`), a systemd unit, an nginx site (`nginx-dawr.conf`), the cron jobs, a backup script, and `.env.example` gains `DATABASE_URL`.
7. **Tests:** the full e2e suite (99 cases) run against a real Postgres, not just the dev backend.

---

## Part 2: your server (you, over SSH)

Log in as `dawr` from PowerShell: `ssh dawr@45.63.100.246`. Your PC's key (`C:\Users\user\.ssh\id_ed25519`) lets you in without a password; the `dawr` password is only for `sudo`.

### 2.1 Check the basics: done (2026-11-01)

Ubuntu 26.10, 2 GB RAM plus 6 GB swap already set up, 45 GB disk free.

### 2.2 A non-root user and the firewall: done (2026-11-01), updates still to run

Done already: user `dawr` with sudo and your key; `/etc/ssh/sshd_config.d/00-hardening.conf` (set up before) refuses passwords and root logins; the firewall (`ufw`) allows only 22, 80 and 443; Vultr Automatic Backups are on.

Still to run, as `dawr`:

```bash
sudo apt update && sudo apt upgrade -y
```

This may restart nginx for a second, which the other two sites will hardly notice. If it ends with "a reboot is required", reboot at a quiet time with `sudo reboot`; the hifzapp Node app is started by the `ameen` user, so check it comes back afterwards.

### 2.3 Install Node 22 and PostgreSQL

nginx, certbot and git are already on this server. Node isn't installed system-wide (the hifzapp uses its own copy in `/home/ameen`, which this doesn't touch).

```bash
# Node 22 LTS, the version the app is built and tested on
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL 18 (Ubuntu's own package; listens on localhost only by default)
sudo apt install -y postgresql

node -v && psql --version
```

### 2.4 Create the database

Two roles: `dawr_owner` owns the tables and runs migrations; `dawr_app` is what the running app uses, and row security applies to it.

```bash
sudo -u postgres psql
```

Then, inside psql (make up two long random passwords; `openssl rand -base64 32` in another terminal makes one):

```sql
create role anon nologin;
create role authenticated nologin;
create role dawr_owner login password 'OWNER_PASSWORD';
create role dawr_app   login password 'APP_PASSWORD';
grant authenticated to dawr_app;
create database dawr owner dawr_owner encoding 'UTF8' template template0;
\q
```

(`anon` and `authenticated` are the role names the database rules were written with; `dawr_app` acts as `authenticated`. This is the same setup `npm run db:local` makes on a development machine.)

Write both passwords down in your password manager. Don't send them to Claude.

### 2.5 Point your domain at the server

Wherever hifzapp.link's DNS is managed (where `hifzapp.link` already points at this server), add:

| type | name | value |
| --- | --- | --- |
| A | `dawr` | 45.63.100.246 |

No AAAA record: the sites on this server answer on IPv4 only.

Check with `nslookup dawr.hifzapp.link` until it shows 45.63.100.246 (minutes to an hour).

### 2.6 Resend, for email

1. Create a Resend account at resend.com.
2. **Domains → Add domain** → your domain. Add the DNS records it shows (SPF, DKIM) at your registrar, and wait for "Verified".
3. **API Keys → Create** with "Sending access" only. Keep it for step 3.2.

---

## Part 3: deploy (you run it, Claude wrote it)

**Status on nazira-server, 2026-11-01** (Claude ran these over SSH as `dawr`, with temporary password-free sudo):

- Node 22.23.4 and PostgreSQL 18.6 installed; Postgres listens on localhost only.
- 3.1: the code was **copied from the PC** (`git archive` of 455b30e over SSH, plus the new nginx file) instead of cloned, so the server has no GitHub access and `~/app` is not a git checkout. `update.sh` (3.6) therefore doesn't work yet.
- 2.4 and 3.2: roles and the `dawr` database (UTF8) created; `.env.production.local` written by the server with random passwords and `CRON_SECRET` that nobody saw. **Still empty: `RESEND_API_KEY`, `EMAIL_FROM`.**
- 3.3: `npm ci` and `npm run db:migrate` done (5 migrations, 240 quarters; `dawr_app` has no superuser or bypass-RLS rights). **`npm run build` waits for the Resend key**: the app refuses a production build without email. The `dawr` service is installed and enabled but not started.
- 3.4: Dawr's nginx site is in and nginx reloaded; both other sites still answer 200. DNS record `dawr` (A, DNS only) added in Cloudflare; certbot certificate issued, expires 2027-01-30, renews automatically; http redirects to https.
- 3.5: nightly jobs installed (03:00 and 03:30 UTC); a test backup worked, readable by `dawr` only.
- 2.6: Resend domain hifzapp.link (Ireland region) verified via manual DNS records in Cloudflare (`resend._domainkey`, `rsend`, `send`, `_dmarc`); sending-only API key in the secrets file; `EMAIL_FROM=Dawr <noreply@hifzapp.link>`; a test send to delivered@resend.dev returned 200.
- 3.3 finished: build passed, `dawr` service running, **live at https://dawr.hifzapp.link**. Sample account and a rating that survives a reload checked in a browser; no errors in the log.
- **Still to do:** the Part 4 checks that need a real inbox (sign-up confirmation, password reset, a second account); remove `/etc/sudoers.d/90-dawr-temp` (password-free sudo for the setup); a way to update the code without git on the server.

### 3.1 Get the code onto the server

The GitHub repo is private, so give the server a read-only key:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/github_dawr -N ""
cat ~/.ssh/github_dawr.pub
```

On GitHub: the repo → **Settings → Deploy keys → Add deploy key**, paste it, leave "Allow write access" **off**. Then:

```bash
printf 'Host github.com\n  IdentityFile ~/.ssh/github_dawr\n' >> ~/.ssh/config
git clone git@github.com:erina-digitables/replicaquarandawr.git ~/app
```

### 3.2 The secrets file

```bash
cd ~/app/web
cp .env.example .env.production.local
chmod 600 .env.production.local
nano .env.production.local
```

Fill in the values `.env.example` lists, among them:

- `DATABASE_URL=postgres://dawr_app:APP_PASSWORD@127.0.0.1:5432/dawr`
- `MIGRATE_DATABASE_URL=postgres://dawr_owner:OWNER_PASSWORD@127.0.0.1:5432/dawr`
- `SITE_URL=https://dawr.hifzapp.link`
- `RESEND_API_KEY`, `EMAIL_FROM` (an address on your verified domain)
- `CRON_SECRET` (another `openssl rand -base64 32`)
- leave the `SUPABASE_*` lines empty

### 3.3 Build, migrate, start

```bash
cd ~/app/web
npm ci
npm run db:migrate          # creates the tables, rules and 240 quarters
npm run build
sudo cp ../deploy/dawr.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now dawr
systemctl status dawr       # should say "active (running)"
```

### 3.4 HTTPS

The DNS record from 2.5 must resolve first.

```bash
sudo cp ../deploy/nginx-dawr.conf /etc/nginx/sites-available/dawr
sudo ln -s /etc/nginx/sites-available/dawr /etc/nginx/sites-enabled/dawr
sudo nginx -t                          # must say "syntax is ok" and "test is successful"
sudo systemctl reload nginx
sudo certbot --nginx -d dawr.hifzapp.link
```

`nginx -t` checks every site's settings before anything changes. If it reports an error, stop and run `sudo rm /etc/nginx/sites-enabled/dawr`: the other two sites keep running on the old settings. Certbot then gets the certificate, adds the HTTPS part to Dawr's file and the redirect from http, and renews it with the others.

Open `https://dawr.hifzapp.link`.

### 3.5 Nightly jobs

```bash
crontab ../deploy/crontab
crontab -l
```

At 03:00 server time, this purges sample accounts older than a day and writes a compressed database dump to `~/backups`, keeping 14 days. Copy a backup off the server now and then (or turn on Vultr's Automatic Backups, step 2.2).

### 3.6 Updating later

```bash
cd ~/app && git pull && cd web && npm ci && npm run db:migrate && npm run build && sudo systemctl restart dawr
```

`deploy/update.sh` does exactly this.

---

## Part 4: checks before you tell anyone

- [ ] Sign up with your real email → the confirmation email arrives from your domain, the link works.
- [ ] Rate four quarters, reload: kept.
- [ ] Sign up a second account in a private window: it sees none of the first one's data.
- [ ] Forgot password → the code arrives, reset works, the other browser is signed out.
- [ ] "Try it with sample data" works; the next morning it's gone (`journalctl -u dawr` shows the purge).
- [ ] `ls ~/backups` shows last night's dump.
- [ ] `sudo ss -tlnp` shows Postgres and Dawr's Node (:3000) on `127.0.0.1` only, and only nginx on 80/443. (The hifzapp's Node on 3001 listens on all addresses, but the firewall blocks it from outside.)
- [ ] tahiracademytrust.org and hifzapp.link still load.
- [ ] The privacy page lists the operator's name and contact, and Vultr and Resend as processors (Claude updates the processors; the name and contact are yours).
