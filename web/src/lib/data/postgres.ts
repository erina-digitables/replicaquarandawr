// Production backend on your own Postgres (replica/vultr.md). Same schema and
// rules as Supabase: db/postgres/*_auth.sql stands in for Supabase Auth.
// Every read and write of user data runs in a transaction that first sets
// app.user_id, so row level security decides what the query can touch. The app
// role does not own the tables, so it cannot skip those rules.
import { createHash, randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import pg from "pg";
import { renderTemplate, sendEmail } from "@/lib/email";
import type { Backend, ProfilePatch, SignInResult, SignUpResult } from "./backend";
import { demoDays } from "./fake";
import { DataError, type DayLog, type DaySummary, type Profile, type Theme } from "./types";

export function postgresConfigured() {
  return !!process.env.DATABASE_URL;
}

const COOKIE = "dawr_session";
const SESSION_DAYS = 30;
const RESET_MINUTES = 15;
const CONFIRM_HOURS = 48;
const MAX_CODE_TRIES = 5;

// DATE stays a plain "2026-10-31" string; the app never wants a JS Date for a day.
pg.types.setTypeParser(1082, (v) => v);

const g = globalThis as unknown as { __dawrPool?: pg.Pool };
function pool() {
  g.__dawrPool ??= new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
  return g.__dawrPool;
}

type Tx = pg.PoolClient;

/** Runs fn in one transaction as the given user (null = no one signed in). */
async function tx<T>(userId: string | null, fn: (c: Tx) => Promise<T>): Promise<T> {
  const c = await pool().connect();
  try {
    await c.query("begin");
    await c.query("select set_config('app.user_id', $1, true)", [userId ?? ""]);
    const out = await fn(c);
    await c.query("commit");
    return out;
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

// --- passwords and tokens ----------------------------------------------------

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

async function hashPassword(password: string) {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${(await scryptAsync(password, salt, 64)).toString("hex")}`;
}

// Checked against when the account doesn't exist, so a wrong username takes as long as a wrong password.
const DUMMY_HASH = `${"0".repeat(32)}:${"0".repeat(128)}`;

async function checkPassword(password: string, stored: string | null) {
  const [salt, hash] = (stored ?? DUMMY_HASH).split(":");
  const a = Buffer.from(hash, "hex");
  const b = await scryptAsync(password, Buffer.from(salt, "hex"), 64);
  return !!stored && a.length === b.length && timingSafeEqual(a, b);
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");

function sameHash(a: string, b: string) {
  return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function siteUrl() {
  return (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** Whether new accounts must confirm their email. Off only when mail goes to a local folder (tests). */
const confirmationRequired = () => !process.env.DAWR_MAIL_DIR;

// --- sessions ------------------------------------------------------------------

async function startSession(userId: string) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  await pool().query("insert into auth.sessions (token_hash, user_id, expires_at) values ($1, $2, $3)", [sha256(token), userId, expiresAt]);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

async function sessionUserId(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const { rows } = await pool().query<{ user_id: string }>(
    "select user_id from auth.sessions where token_hash = $1 and expires_at > now()",
    [sha256(token)],
  );
  return rows[0]?.user_id ?? null;
}

// --- rows ----------------------------------------------------------------------

type ProfileRow = {
  id: string;
  full_name: string;
  username: string;
  daily_target: number;
  timezone: string;
  theme: Theme;
  is_demo: boolean;
  created_at: Date;
  email: string | null;
};

const PROFILE_SELECT = `select p.id, p.full_name, p.username, p.daily_target, p.timezone, p.theme, p.is_demo, p.created_at, u.email
  from profiles p join auth.users u on u.id = p.id where p.id = $1`;

function toProfile(r: ProfileRow): Profile {
  return {
    id: r.id,
    fullName: r.full_name,
    username: r.username,
    email: r.email ?? "",
    dailyTarget: r.daily_target,
    timezone: r.timezone,
    theme: r.theme,
    isDemo: r.is_demo,
    createdAt: r.created_at.toISOString(),
  };
}

/** One day with its quarters. json_agg keeps timestamps as ISO strings with an offset. */
const DAY_SELECT = `select d.log_date, d.target_quarters, d.plan_locked,
    coalesce(json_agg(json_build_object('rub', q.rub, 'planned', q.planned, 'quality', q.quality, 'completedAt', q.completed_at)
      order by q.rub) filter (where q.rub is not null), '[]') as quarters
  from daily_logs d left join log_quarters q on q.log_id = d.id
  where d.user_id = $1 and d.log_date = $2 group by d.id`;

type DayRow = { log_date: string; target_quarters: number; plan_locked: boolean; quarters: DayLog["quarters"] };

const toDay = (r: DayRow): DayLog => ({ date: r.log_date, target: r.target_quarters, planLocked: r.plan_locked, quarters: r.quarters });

async function readDay(c: Tx, userId: string, date: string) {
  const { rows } = await c.query<DayRow>(DAY_SELECT, [userId, date]);
  return rows[0] && toDay(rows[0]);
}

/** Account by username or email. Usernames resolve through email_for_username, as on Supabase. */
async function findAccount(identifier: string) {
  const id = identifier.trim().toLowerCase();
  const { rows } = await pool().query<{ id: string; email: string; password_hash: string | null; email_confirmed_at: Date | null }>(
    `select id, email::text, password_hash, email_confirmed_at from auth.users
      where email = (case when $1 like '%@%' then $1 else email_for_username($1::citext) end)::citext`,
    [id],
  );
  return rows[0];
}

function quartersJson(day: DayLog) {
  return JSON.stringify(day.quarters.map((q) => ({ rub: q.rub, planned: q.planned, quality: q.quality, completed_at: q.completedAt })));
}

/** Sends a confirmation link. A resend within 10 minutes of the last one is skipped, so sign-in tries can't flood an inbox. */
async function sendConfirmation(userId: string, email: string) {
  const token = newToken();
  const { rowCount } = await pool().query(
    `insert into auth.one_time_tokens (user_id, purpose, token_hash, expires_at) values ($1, 'confirm', $2, $3)
      on conflict (user_id, purpose) do update set token_hash = excluded.token_hash, expires_at = excluded.expires_at, attempts = 0
      where one_time_tokens.expires_at < $3 - interval '10 minutes'`,
    [userId, sha256(token), new Date(Date.now() + CONFIRM_HOURS * 3600e3)],
  );
  if (!rowCount) return;
  // The link carries the raw token; only its hash is stored.
  await sendEmail({
    to: email,
    subject: "Confirm your email for Dawr",
    html: renderTemplate("confirmation", { SiteURL: siteUrl(), TokenHash: token }),
  });
}

const isUnique = (e: unknown, constraint: string) =>
  e instanceof pg.DatabaseError && e.code === "23505" && e.constraint === constraint;

// --- the backend -----------------------------------------------------------------

export const postgresBackend: Backend = {
  name: "postgres",

  async currentUser() {
    const userId = await sessionUserId();
    if (!userId) return null;
    return tx(userId, async (c) => {
      const { rows } = await c.query<ProfileRow>(PROFILE_SELECT, [userId]);
      return rows[0] ? toProfile(rows[0]) : null;
    });
  },

  async signUp(input): Promise<SignUpResult> {
    const meta = { full_name: input.fullName.trim(), username: input.username.toLowerCase(), timezone: input.timezone };
    let userId: string;
    try {
      // The profile row is created by the handle_new_user trigger, in the same transaction.
      const { rows } = await pool().query<{ id: string }>(
        `insert into auth.users (email, password_hash, raw_user_meta_data, email_confirmed_at)
          values ($1, $2, $3, case when $4 then null else now() end) returning id`,
        [input.email.trim().toLowerCase(), await hashPassword(input.password), meta, confirmationRequired()],
      );
      userId = rows[0].id;
    } catch (e) {
      if (isUnique(e, "profiles_username_key")) return { ok: false, field: "username", message: "That username is taken." };
      if (isUnique(e, "users_email_key")) return { ok: false, field: "email", message: "There's already an account with that email." };
      throw e;
    }
    if (confirmationRequired()) {
      await sendConfirmation(userId, input.email.trim().toLowerCase());
      return { ok: true, confirmEmail: input.email };
    }
    await startSession(userId);
    return { ok: true };
  },

  async signIn(identifier, password): Promise<SignInResult> {
    const u = await findAccount(identifier);
    if (!(await checkPassword(password, u?.password_hash ?? null)) || !u) return "invalid";
    if (!u.email_confirmed_at) {
      await sendConfirmation(u.id, u.email); // a fresh link, in case the first one expired
      return "unconfirmed";
    }
    await startSession(u.id);
    return "ok";
  },

  async signOut() {
    const jar = await cookies();
    const token = jar.get(COOKIE)?.value;
    if (token) await pool().query("delete from auth.sessions where token_hash = $1", [sha256(token)]);
    jar.delete(COOKIE);
  },

  async confirmEmail(tokenHash, type) {
    if (type !== "email" && type !== "signup") return false;
    const { rows } = await pool().query<{ user_id: string }>(
      `delete from auth.one_time_tokens where purpose = 'confirm' and token_hash = $1 and expires_at > now() returning user_id`,
      [sha256(tokenHash)],
    );
    const userId = rows[0]?.user_id;
    if (!userId) return false;
    await pool().query("update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where id = $1", [userId]);
    await startSession(userId);
    return true;
  },

  async startDemo(timezone, today) {
    // A sample account has no email and no password: it lives only in its session cookie.
    const { rows } = await pool().query<{ id: string }>(
      "insert into auth.users (raw_user_meta_data) values ($1) returning id",
      [{ full_name: "Demo reader", timezone, is_demo: true }],
    );
    const userId = rows[0].id;
    await tx(userId, async (c) => {
      for (const day of demoDays(today))
        await c.query("select restore_day($1, $2::smallint, false, $3::jsonb)", [day.date, day.target, quartersJson(day)]);
    });
    await startSession(userId);
  },

  async requestPasswordReset(identifier) {
    const u = await findAccount(identifier);
    if (!u) return;
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await pool().query(
      `insert into auth.one_time_tokens (user_id, purpose, token_hash, expires_at) values ($1, 'reset', $2, $3)
        on conflict (user_id, purpose) do update set token_hash = excluded.token_hash, expires_at = excluded.expires_at, attempts = 0`,
      [u.id, sha256(`${u.id}:${code}`), new Date(Date.now() + RESET_MINUTES * 6e4)],
    );
    await sendEmail({ to: u.email, subject: "Your Dawr password reset code", html: renderTemplate("recovery", { Token: code, SiteURL: siteUrl() }) });
  },

  async resetPassword(identifier, code, newPassword) {
    const u = await findAccount(identifier);
    if (!u) return false;
    // Count the attempt first, so guesses are capped even when they race each other.
    const { rows } = await pool().query<{ token_hash: string; attempts: number }>(
      `update auth.one_time_tokens set attempts = attempts + 1
        where user_id = $1 and purpose = 'reset' and expires_at > now() returning token_hash, attempts`,
      [u.id],
    );
    const t = rows[0];
    if (!t || t.attempts > MAX_CODE_TRIES || !sameHash(t.token_hash, sha256(`${u.id}:${code.trim()}`))) return false;
    await tx(null, async (c) => {
      // The code came by email, so the address is proven too.
      await c.query("update auth.users set password_hash = $2, email_confirmed_at = coalesce(email_confirmed_at, now()) where id = $1", [
        u.id,
        await hashPassword(newPassword),
      ]);
      await c.query("delete from auth.one_time_tokens where user_id = $1 and purpose = 'reset'", [u.id]);
      await c.query("delete from auth.sessions where user_id = $1", [u.id]); // signed out everywhere
    });
    return true;
  },

  async changePassword(userId, current, next) {
    const { rows } = await pool().query<{ password_hash: string | null }>("select password_hash from auth.users where id = $1", [userId]);
    if (!rows[0] || !(await checkPassword(current, rows[0].password_hash))) return false;
    await pool().query("update auth.users set password_hash = $2 where id = $1", [userId, await hashPassword(next)]);
    return true;
  },

  async deleteAccount(userId) {
    // Cascades to sessions, codes, the profile, logs and quarters.
    await pool().query("delete from auth.users where id = $1", [userId]);
    (await cookies()).delete(COOKIE);
  },

  async purgeDemo(createdBefore) {
    const { rows } = await tx(null, async (c) => {
      const run = await c.query<{ id: string }>("insert into job_runs (job) values ('purge-demo') returning id");
      const res = await c.query<{ n: number }>("select purge_demo_accounts($1) as n", [createdBefore]);
      await c.query("delete from auth.sessions where expires_at < now()");
      await c.query("delete from auth.one_time_tokens where expires_at < now()");
      await c.query("update job_runs set finished_at = now(), ok = true, detail = $2 where id = $1", [run.rows[0].id, { deleted: res.rows[0].n }]);
      return res;
    });
    return { deleted: rows[0].n, failed: 0 };
  },

  async rateLimit(key, max, windowSeconds) {
    const { rows } = await pool().query<{ ok: boolean }>("select hit_rate_limit($1, $2, $3) as ok", [sha256(key), max, windowSeconds]);
    return rows[0].ok === true;
  },

  async updateProfile(userId, patch: ProfilePatch) {
    try {
      return await tx(userId, async (c) => {
        const { rowCount } = await c.query(
          `update profiles set
            full_name = coalesce($2, full_name), username = coalesce($3, username), daily_target = coalesce($4, daily_target),
            timezone = coalesce($5, timezone), theme = coalesce($6, theme)
          where id = $1`,
          [userId, patch.fullName ?? null, patch.username?.toLowerCase() ?? null, patch.dailyTarget ?? null, patch.timezone ?? null, patch.theme ?? null],
        );
        if (!rowCount) throw new DataError("unauthorized", "Profile not found");
        const { rows } = await c.query<ProfileRow>(PROFILE_SELECT, [userId]);
        return toProfile(rows[0]);
      });
    } catch (e) {
      if (isUnique(e, "profiles_username_key")) throw new DataError("conflict", "username");
      throw e;
    }
  },

  async setTheme(userId, theme) {
    await tx(userId, (c) => c.query("update profiles set theme = $2 where id = $1", [userId, theme]));
  },

  async getDay(userId, date) {
    return tx(userId, (c) => readDay(c, userId, date));
  },

  async previousActiveDay(userId, date) {
    return tx(userId, async (c) => {
      const { rows } = await c.query<{ log_date: string }>(
        "select log_date from day_summaries where user_id = $1 and log_date < $2 and done_count > 0 order by log_date desc limit 1",
        [userId, date],
      );
      return rows[0] ? readDay(c, userId, rows[0].log_date) : undefined;
    });
  },

  async setQuality(userId, date, rub, quality) {
    await tx(userId, (c) => c.query("select set_quality($1, $2::smallint, $3)", [date, rub, quality]));
  },

  async savePlan(userId, date, rubs, locked) {
    await tx(userId, (c) => c.query("select save_plan($1, $2::smallint[], $3)", [date, rubs, locked]));
  },

  async setDailyTarget(userId, target) {
    await tx(userId, (c) => c.query("select set_daily_target($1::smallint)", [target]));
  },

  async deleteDay(userId, date) {
    return tx(userId, async (c) => {
      const day = await readDay(c, userId, date);
      if (day) await c.query("delete from daily_logs where user_id = $1 and log_date = $2", [userId, date]);
      return day;
    });
  },

  async restoreDay(userId, day) {
    await tx(userId, (c) =>
      c.query("select restore_day($1, $2::smallint, $3, $4::jsonb)", [day.date, day.target, day.planLocked, quartersJson(day)]),
    );
  },

  async resetAllLogs(userId) {
    await tx(userId, (c) => c.query("delete from daily_logs where user_id = $1", [userId]));
  },

  async listDays(userId): Promise<DaySummary[]> {
    return tx(userId, async (c) => {
      const { rows } = await c.query<{
        log_date: string;
        target_quarters: number;
        done_count: string;
        needs_work_count: string;
        goal_met: boolean;
        juz_touched: number[] | null;
      }>(
        `select log_date, target_quarters, done_count, needs_work_count, goal_met, juz_touched
          from day_summaries where user_id = $1 and quarter_rows > 0 order by log_date desc`,
        [userId],
      );
      return rows.map((r) => ({
        date: r.log_date,
        target: r.target_quarters,
        done: Number(r.done_count),
        needsWork: Number(r.needs_work_count),
        goalMet: r.goal_met,
        juz: (r.juz_touched ?? []).slice().sort((a, b) => a - b),
      }));
    });
  },
};
