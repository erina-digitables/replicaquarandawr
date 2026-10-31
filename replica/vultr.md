# Moving Dawr to your Vultr server

Everything runs on your one Ubuntu server: PostgreSQL, the app, and Caddy in front of it for HTTPS. Email still goes through Resend, since a server can't reliably send mail that lands in inboxes on its own.

```
browser ──HTTPS──> Caddy (:443) ──> Next.js app (:3000, localhost only) ──> PostgreSQL (:5432, localhost only)
                                              └──> Resend API (confirmation + reset emails)
cron (nightly) ──> purge old sample accounts, back up the database
```

Who does what: **you** run everything on the server and in the Vultr, DNS and Resend dashboards; **Claude** writes the code and config and never sees a password, key or connection string. Where a step makes a secret, you put it straight into a file on the server.

---

## Part 1: code changes (Claude, on this machine)

**Status 2026-10-31: written and tested locally, not committed yet.** Postgres suite 94 of 95 run (the one failure was a test race, fixed). One open issue to re-check on the real server: BUG-010 in `bugs.md`.

Nothing below touches the screens. The app already talks to storage through one `Backend` interface (`web/src/lib/data/backend.ts`); this adds a third one.

1. **A small `auth` schema for plain Postgres.** The existing migrations expect Supabase's `auth.users` table and `auth.uid()` function. A new first migration creates both: a `users` table (email, password hash, confirmed time) and `auth.uid()` reading the signed-in user from the current transaction. Result: the three existing migrations and every row security rule run **unchanged**, and `npm run db:test` keeps checking that a second user sees nothing.
2. **`web/src/lib/data/postgres.ts`**, the new backend, using `pg` (node-postgres) and a connection pool. Each request runs in a transaction that sets the user first, so the database itself refuses other people's rows. The app connects as a role that is **not** the table owner, so those rules can't be skipped.
3. **Our own sign-in**, moved from the dev backend onto Postgres tables: hashed passwords (scrypt, without blocking the server), sessions in httpOnly secure cookies, reset codes, rate limits, sign out everywhere on password reset. Sign-up and reset emails are sent through Resend with the existing templates.
4. **Backend choice** in `web/src/lib/data/index.ts`: `DATABASE_URL` set → Postgres. Supabase stays as an option.
5. **Client IP fix** (`bugs.md` "to check"): behind Caddy, the app trusts only the address Caddy sets, so the per-network rate limits can't be dodged with a fake header.
6. **Deploy files** in `deploy/`: a migration runner (`npm run db:migrate`), a systemd unit, a Caddyfile, the cron jobs, a backup script, and `.env.example` gains `DATABASE_URL`.
7. **Tests:** the full e2e suite (99 cases) run against a real Postgres, not just the dev backend.

---

## Part 2: your server (you, over SSH)

Log in as root once: `ssh root@YOUR_SERVER_IP`. Replace `YOUR_…` placeholders as you go.

### 2.1 Check the basics

```bash
lsb_release -a     # Ubuntu 22.04 or 24.04
free -h            # RAM: building the app needs about 2 GB
df -h /            # at least 10 GB free
```

If RAM is under 2 GB, add swap so the build doesn't run out of memory:

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### 2.2 Updates, a non-root user, the firewall

```bash
apt update && apt upgrade -y
adduser dawr                      # pick a strong password; it's only for sudo
usermod -aG sudo dawr
rsync --archive --chown=dawr:dawr ~/.ssh /home/dawr   # lets your SSH key log in as dawr
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable
```

Check that `ssh dawr@YOUR_SERVER_IP` works in a **new** terminal before you close the root one. From now on, log in as `dawr`.

Optional but worth it: in the Vultr dashboard, turn on **Automatic Backups** for the server (a few dollars a month, whole-server snapshots).

### 2.3 Install Node 22, PostgreSQL and Caddy

```bash
# Node 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git

# PostgreSQL (Ubuntu's own package; listens on localhost only by default)
sudo apt install -y postgresql

# Caddy (automatic HTTPS certificates)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

node -v && psql --version && caddy version
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

At your domain registrar's DNS settings, add:

| type | name | value |
| --- | --- | --- |
| A | `dawr` (or `@` for the bare domain) | YOUR_SERVER_IP |
| AAAA | same | the server's IPv6, if Vultr gave it one |

Check with `nslookup dawr.YOUR_DOMAIN` until it shows your IP (minutes to an hour).

### 2.6 Resend, for email

1. Create a Resend account at resend.com.
2. **Domains → Add domain** → your domain. Add the DNS records it shows (SPF, DKIM) at your registrar, and wait for "Verified".
3. **API Keys → Create** with "Sending access" only. Keep it for step 3.2.

---

## Part 3: deploy (you run it, Claude wrote it)

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
- `SITE_URL=https://dawr.YOUR_DOMAIN`
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

```bash
sudo cp ../deploy/Caddyfile /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile        # put your domain on the first line
sudo systemctl reload caddy
```

Open `https://dawr.YOUR_DOMAIN`. Caddy gets the certificate on the first visit.

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
- [ ] `sudo ss -tlnp` shows Postgres and Node on `127.0.0.1` only, and only Caddy on 80/443.
- [ ] The privacy page lists the operator's name and contact, and Vultr and Resend as processors (Claude updates the processors; the name and contact are yours).
