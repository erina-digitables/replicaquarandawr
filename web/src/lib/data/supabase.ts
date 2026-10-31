// Production backend: Supabase Postgres + Supabase Auth.
// Reads go through row level security as the signed-in user; writes call the
// database functions in supabase/migrations/*_functions.sql. The service role
// is used only for username lookup, rate limits, account deletion and seeding.
import { createHash } from "node:crypto";
import { adminClient, scratchClient, userClient } from "@/lib/supabase/clients";
import type { EmailOtpType } from "@supabase/supabase-js";
import type { ISODate } from "@/lib/dates";
import type { Backend, ProfilePatch, SignInResult, SignUpResult } from "./backend";
import { demoDays } from "./fake";
import { DataError, type DayLog, type DaySummary, type LogQuarter, type Profile, type Quality, type Theme } from "./types";

export function supabaseConfigured() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

type ProfileRow = {
  id: string;
  full_name: string;
  username: string;
  daily_target: number;
  timezone: string;
  theme: Theme;
  is_demo: boolean;
  created_at: string;
};

type LogRow = {
  log_date: string;
  target_quarters: number;
  plan_locked: boolean;
  log_quarters: { rub: number; planned: boolean; quality: Quality | null; completed_at: string | null }[];
};

const LOG_SELECT = "log_date, target_quarters, plan_locked, log_quarters(rub, planned, quality, completed_at)";

function toProfile(row: ProfileRow, email: string | null | undefined): Profile {
  return {
    id: row.id,
    fullName: row.full_name,
    username: row.username,
    email: email ?? "",
    dailyTarget: row.daily_target,
    timezone: row.timezone,
    theme: row.theme,
    isDemo: row.is_demo,
    createdAt: row.created_at,
  };
}

function toDay(row: LogRow): DayLog {
  return {
    date: row.log_date,
    target: row.target_quarters,
    planLocked: row.plan_locked,
    quarters: row.log_quarters
      .map((q): LogQuarter => ({ rub: q.rub, planned: q.planned, quality: q.quality, completedAt: q.completed_at }))
      .sort((a, b) => a.rub - b.rub),
  };
}

/** Raise anything unexpected; the screen's error boundary shows a calm message. */
function must<T>(res: { data: T; error: { message: string; code?: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}

async function emailFor(identifier: string): Promise<string | null> {
  const id = identifier.trim().toLowerCase();
  if (id.includes("@")) return id;
  const { data, error } = await adminClient().rpc("email_for_username", { p_username: id });
  if (error) throw new Error(`username lookup: ${error.message}`);
  return (data as string | null) ?? null;
}

async function usernameTaken(username: string, exceptId?: string) {
  let query = adminClient().from("profiles").select("id").eq("username", username.toLowerCase()).limit(1);
  if (exceptId) query = query.neq("id", exceptId);
  const { data, error } = await query;
  if (error) throw new Error(`username check: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

export const supabaseBackend: Backend = {
  name: "supabase",

  async currentUser() {
    const sb = await userClient();
    // getUser() checks the token with Supabase Auth instead of trusting the cookie.
    const { data } = await sb.auth.getUser();
    if (!data.user) return null;
    const { data: row } = await sb.from("profiles").select("*").eq("id", data.user.id).maybeSingle<ProfileRow>();
    return row ? toProfile(row, data.user.email) : null;
  },

  async signUp(input): Promise<SignUpResult> {
    if (await usernameTaken(input.username)) return { ok: false, field: "username", message: "That username is taken." };
    const sb = await userClient();
    const site = process.env.SITE_URL ?? "http://localhost:3000";
    const { data, error } = await sb.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo: `${site}/auth/confirm`,
        data: { full_name: input.fullName, username: input.username.toLowerCase(), timezone: input.timezone },
      },
    });
    if (error) {
      if (error.code === "user_already_exists" || /already registered/i.test(error.message))
        return { ok: false, field: "email", message: "There's already an account with that email." };
      if (error.code === "weak_password") return { ok: false, field: "password", message: "Choose a stronger password." };
      throw new Error(`sign up: ${error.message}`);
    }
    // With email confirmation on, Supabase returns a user but no session. (It also does this,
    // deliberately, for an email that is already registered, so the answer reveals nothing.)
    if (!data.session) return { ok: true, confirmEmail: input.email };
    return { ok: true };
  },

  async signIn(identifier, password): Promise<SignInResult> {
    const email = await emailFor(identifier);
    if (!email) return "invalid";
    const sb = await userClient();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (!error) return "ok";
    if (error.code === "email_not_confirmed") return "unconfirmed";
    if (error.code === "invalid_credentials" || error.status === 400) return "invalid";
    throw new Error(`sign in: ${error.message}`);
  },

  async signOut() {
    const sb = await userClient();
    await sb.auth.signOut({ scope: "local" });
  },

  async startDemo(timezone, today) {
    // Needs "Allow anonymous sign-ins" in Supabase Auth settings.
    const sb = await userClient();
    const { data, error } = await sb.auth.signInAnonymously({
      options: { data: { full_name: "Demo reader", timezone, is_demo: true } },
    });
    if (error || !data.user) throw new Error(`demo: ${error?.message ?? "no user"}`);
    for (const day of demoDays(today)) {
      must(
        await sb.rpc("restore_day", {
          p_date: day.date,
          p_target: day.target,
          p_locked: false,
          p_quarters: day.quarters.map((q) => ({ rub: q.rub, planned: q.planned, quality: q.quality, completed_at: q.completedAt })),
        }),
        "demo seed",
      );
    }
  },

  async requestPasswordReset(identifier) {
    const email = await emailFor(identifier);
    if (!email) return;
    // The Reset Password email template shows {{ .Token }} (supabase/templates/recovery.html).
    const { error } = await scratchClient().auth.resetPasswordForEmail(email);
    // Swallow "user not found"-style errors so the screen never reveals whether an account exists.
    if (error && error.status !== 400 && error.status !== 404 && error.status !== 422) throw new Error(`reset: ${error.message}`);
  },

  async resetPassword(identifier, code, newPassword) {
    const email = await emailFor(identifier);
    if (!email) return false;
    const sb = await userClient();
    const { error } = await sb.auth.verifyOtp({ email, token: code, type: "recovery" });
    if (error) return false;
    const upd = await sb.auth.updateUser({ password: newPassword });
    // Sign out every session, including the one verifyOtp just created.
    await sb.auth.signOut({ scope: "global" });
    if (upd.error) throw new Error(`reset: ${upd.error.message}`);
    return true;
  },

  async changePassword(userId, current, next) {
    const sb = await userClient();
    const { data } = await sb.auth.getUser();
    if (!data.user?.email || data.user.id !== userId) return false;
    // Check the current password on a client that holds no cookies.
    const check = await scratchClient().auth.signInWithPassword({ email: data.user.email, password: current });
    if (check.error) return false;
    const upd = await sb.auth.updateUser({ password: next });
    if (upd.error) throw new Error(`change password: ${upd.error.message}`);
    return true;
  },

  async deleteAccount(userId) {
    const sb = await userClient();
    const { data } = await sb.auth.getUser();
    if (data.user?.id !== userId) throw new DataError("unauthorized", "Not your account");
    // Deleting the auth user cascades to profiles, logs and quarters (see the schema migration).
    const { error } = await adminClient().auth.admin.deleteUser(userId);
    if (error) throw new Error(`delete account: ${error.message}`);
    await sb.auth.signOut({ scope: "local" });
  },

  async confirmEmail(tokenHash, type) {
    if (type !== "email" && type !== "signup") return false;
    const sb = await userClient();
    const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType });
    return !error;
  },

  async purgeDemo(createdBefore) {
    // Every run is recorded in job_runs; a failed run stays there with its error.
    const admin = adminClient();
    const run = await admin.from("job_runs").insert({ job: "purge-demo" }).select("id").single<{ id: string }>();
    const runId = run.data?.id;
    let deleted = 0;
    const failed: string[] = [];
    try {
      const { data, error } = await admin.from("profiles").select("id").eq("is_demo", true).lt("created_at", createdBefore.toISOString()).limit(500);
      if (error) throw error;
      for (const { id } of data ?? []) {
        // Retry each delete once before giving up on it.
        let res = await admin.auth.admin.deleteUser(id);
        if (res.error) res = await admin.auth.admin.deleteUser(id);
        if (res.error) failed.push(id);
        else deleted++;
      }
      await admin
        .from("job_runs")
        .update({ finished_at: new Date().toISOString(), ok: failed.length === 0, detail: { deleted, failed } })
        .eq("id", runId);
      return { deleted, failed: failed.length };
    } catch (e) {
      await admin
        .from("job_runs")
        .update({ finished_at: new Date().toISOString(), ok: false, detail: { deleted, error: String(e) } })
        .eq("id", runId);
      throw e;
    }
  },

  async rateLimit(key, max, windowSeconds) {
    const hashed = createHash("sha256").update(key).digest("hex");
    const { data, error } = await adminClient().rpc("hit_rate_limit", { p_key: hashed, p_max: max, p_window_seconds: windowSeconds });
    if (error) throw new Error(`rate limit: ${error.message}`);
    return data === true;
  },

  async updateProfile(userId, patch: ProfilePatch) {
    if (patch.username && (await usernameTaken(patch.username, userId))) throw new DataError("conflict", "username");
    const sb = await userClient();
    const row: Record<string, unknown> = {};
    if (patch.fullName !== undefined) row.full_name = patch.fullName;
    if (patch.username !== undefined) row.username = patch.username.toLowerCase();
    if (patch.dailyTarget !== undefined) row.daily_target = patch.dailyTarget;
    if (patch.timezone !== undefined) row.timezone = patch.timezone;
    if (patch.theme !== undefined) row.theme = patch.theme;
    const res = await sb.from("profiles").update(row).eq("id", userId).select("*").single<ProfileRow>();
    if (res.error?.code === "23505") throw new DataError("conflict", "username");
    const { data: auth } = await sb.auth.getUser();
    const updated = must(res, "update profile");
    if (!updated) throw new DataError("unauthorized", "Profile not found");
    return toProfile(updated, auth.user?.email);
  },

  async setTheme(userId, theme) {
    const sb = await userClient();
    must(await sb.from("profiles").update({ theme }).eq("id", userId), "theme");
  },

  async getDay(userId, date) {
    const sb = await userClient();
    const res = await sb.from("daily_logs").select(LOG_SELECT).eq("user_id", userId).eq("log_date", date).maybeSingle<LogRow>();
    const row = must(res, "get day");
    return row ? toDay(row) : undefined;
  },

  async previousActiveDay(userId, date) {
    const sb = await userClient();
    const res = await sb
      .from("day_summaries")
      .select("log_date")
      .eq("user_id", userId)
      .lt("log_date", date)
      .gt("done_count", 0)
      .order("log_date", { ascending: false })
      .limit(1)
      .maybeSingle<{ log_date: string }>();
    const row = must(res, "previous day");
    return row ? this.getDay(userId, row.log_date) : undefined;
  },

  async setQuality(_userId, date, rub, quality) {
    const sb = await userClient();
    must(await sb.rpc("set_quality", { p_date: date, p_rub: rub, p_quality: quality }), "set quality");
  },

  async savePlan(_userId, date, rubs, locked) {
    const sb = await userClient();
    must(await sb.rpc("save_plan", { p_date: date, p_rubs: rubs, p_locked: locked }), "save plan");
  },

  async setDailyTarget(_userId, target) {
    const sb = await userClient();
    must(await sb.rpc("set_daily_target", { p_target: target }), "set target");
  },

  async deleteDay(userId, date) {
    const day = await this.getDay(userId, date);
    if (!day) return undefined;
    const sb = await userClient();
    must(await sb.from("daily_logs").delete().eq("user_id", userId).eq("log_date", date), "delete day");
    return day;
  },

  async restoreDay(_userId, day) {
    const sb = await userClient();
    must(
      await sb.rpc("restore_day", {
        p_date: day.date,
        p_target: day.target,
        p_locked: day.planLocked,
        p_quarters: day.quarters.map((q) => ({ rub: q.rub, planned: q.planned, quality: q.quality, completed_at: q.completedAt })),
      }),
      "restore day",
    );
  },

  async resetAllLogs(userId) {
    const sb = await userClient();
    must(await sb.from("daily_logs").delete().eq("user_id", userId), "reset logs");
  },

  async listDays(userId): Promise<DaySummary[]> {
    const sb = await userClient();
    const res = await sb
      .from("day_summaries")
      .select("log_date, target_quarters, done_count, needs_work_count, goal_met, juz_touched, quarter_rows")
      .eq("user_id", userId)
      .gt("quarter_rows", 0)
      .order("log_date", { ascending: false });
    const rows = must(res, "list days") as {
      log_date: ISODate;
      target_quarters: number;
      done_count: number;
      needs_work_count: number;
      goal_met: boolean;
      juz_touched: number[] | null;
    }[];
    return rows.map((r) => ({
      date: r.log_date,
      target: r.target_quarters,
      done: Number(r.done_count),
      needsWork: Number(r.needs_work_count),
      goalMet: r.goal_met,
      juz: (r.juz_touched ?? []).slice().sort((a, b) => a - b),
    }));
  },
};
