// Development backend: one JSON file on disk, no keys needed. Used when
// Supabase env vars are absent. Same behaviour as supabase.ts, enforced by hand.
import { randomInt } from "node:crypto";
import { cookies } from "next/headers";
import { addDays, type ISODate } from "@/lib/dates";
import { summarize } from "@/lib/dawr";
import { TOTAL_QUARTERS } from "@/lib/quarters";
import type { Backend, ProfilePatch, SignInResult, SignUpInput, SignUpResult } from "./backend";
import { checkPassword, commit, db, hashPassword, newId, newToken, type LogRow, type UserRow } from "./fake-store";
import { DataError, type DayLog, type DaySummary, type Profile, type Quality, type Theme } from "./types";

const COOKIE = "dawr_session";
const SESSION_DAYS = 30;
const RESET_MINUTES = 15;

function toProfile(u: UserRow): Profile {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...p } = u;
  return { ...p };
}

function userById(id: string) {
  const u = db().users.find((x) => x.id === id);
  if (!u) throw new DataError("unauthorized", "No such user");
  return u;
}

function findByIdentifier(identifier: string) {
  const id = identifier.trim().toLowerCase();
  return db().users.find((u) => u.email.toLowerCase() === id || u.username.toLowerCase() === id);
}

async function startSession(userId: string) {
  const token = newToken();
  const expiresAt = Date.now() + SESSION_DAYS * 864e5;
  db().sessions.push({ token, userId, expiresAt });
  commit();
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

function createUser(input: SignUpInput & { isDemo?: boolean }): UserRow {
  const row: UserRow = {
    id: newId(),
    fullName: input.fullName.trim(),
    username: input.username.toLowerCase(),
    email: input.email.trim().toLowerCase(),
    dailyTarget: 4,
    timezone: input.timezone,
    theme: "system",
    isDemo: !!input.isDemo,
    createdAt: new Date().toISOString(),
    passwordHash: hashPassword(input.password),
  };
  db().users.push(row);
  commit();
  return row;
}

function stripLog({ date, target, planLocked, quarters }: LogRow): DayLog {
  return { date, target, planLocked, quarters: quarters.map((q) => ({ ...q })) };
}

function findLog(userId: string, date: ISODate) {
  return db().logs.find((l) => l.userId === userId && l.date === date);
}

/** Gets or creates the day, snapshotting the current target (one log per user per day). */
function ensureLog(userId: string, date: ISODate): LogRow {
  let log = findLog(userId, date);
  if (!log) {
    log = { userId, date, target: userById(userId).dailyTarget, planLocked: false, quarters: [], updatedAt: new Date().toISOString() };
    db().logs.push(log);
  }
  return log;
}

function dropEmptyRows(log: LogRow) {
  log.quarters = log.quarters.filter((q) => q.planned || q.quality);
  log.updatedAt = new Date().toISOString();
}

const limits = new Map<string, { n: number; until: number }>();

export const fakeBackend: Backend = {
  name: "fake",

  async currentUser() {
    const token = (await cookies()).get(COOKIE)?.value;
    if (!token) return null;
    const s = db().sessions.find((x) => x.token === token && x.expiresAt > Date.now());
    const u = s && db().users.find((x) => x.id === s.userId);
    return u ? toProfile(u) : null;
  },

  async signUp(input): Promise<SignUpResult> {
    const d = db();
    if (d.users.some((u) => u.username.toLowerCase() === input.username.toLowerCase()))
      return { ok: false, field: "username", message: "That username is taken." };
    if (d.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase()))
      return { ok: false, field: "email", message: "There's already an account with that email." };
    const u = createUser(input);
    await startSession(u.id);
    return { ok: true };
  },

  async signIn(identifier, password): Promise<SignInResult> {
    const u = findByIdentifier(identifier);
    if (!u || !checkPassword(password, u.passwordHash)) return "invalid";
    await startSession(u.id);
    return "ok";
  },

  async signOut() {
    const jar = await cookies();
    const token = jar.get(COOKIE)?.value;
    const d = db();
    d.sessions = d.sessions.filter((s) => s.token !== token);
    commit();
    jar.delete(COOKIE);
  },

  async startDemo(timezone, today) {
    const tag = newId().slice(0, 8);
    const u = createUser({
      fullName: "Demo reader",
      username: `demo_${tag}`,
      email: `demo_${tag}@demo.invalid`,
      password: newToken(),
      timezone,
      isDemo: true,
    });
    for (const day of demoDays(today)) db().logs.push({ ...day, userId: u.id, updatedAt: new Date().toISOString() });
    commit();
    await startSession(u.id);
  },

  async requestPasswordReset(identifier) {
    const u = findByIdentifier(identifier);
    if (!u) return;
    const d = db();
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    d.resets = d.resets.filter((r) => r.userId !== u.id);
    d.resets.push({ userId: u.id, code, expiresAt: Date.now() + RESET_MINUTES * 6e4, attempts: 0 });
    commit();
    // No email in the dev backend. Print the code, never the address.
    console.info(`[dev] password reset code: ${code}`);
  },

  async resetPassword(identifier, code, newPassword) {
    const u = findByIdentifier(identifier);
    const d = db();
    const r = u && d.resets.find((x) => x.userId === u.id && x.expiresAt > Date.now());
    if (!u || !r) return false;
    r.attempts++;
    if (r.attempts > 5 || r.code !== code.trim()) {
      commit();
      return false;
    }
    u.passwordHash = hashPassword(newPassword);
    d.resets = d.resets.filter((x) => x !== r);
    d.sessions = d.sessions.filter((s) => s.userId !== u.id);
    commit();
    return true;
  },

  async changePassword(userId, current, next) {
    const u = userById(userId);
    if (!checkPassword(current, u.passwordHash)) return false;
    u.passwordHash = hashPassword(next);
    commit();
    return true;
  },

  async deleteAccount(userId) {
    const d = db();
    d.users = d.users.filter((u) => u.id !== userId);
    d.sessions = d.sessions.filter((s) => s.userId !== userId);
    d.resets = d.resets.filter((r) => r.userId !== userId);
    d.logs = d.logs.filter((l) => l.userId !== userId);
    commit();
    (await cookies()).delete(COOKIE);
  },

  async rateLimit(key, max, windowSeconds) {
    const now = Date.now();
    const a = limits.get(key);
    if (!a || a.until < now) {
      limits.set(key, { n: 1, until: now + windowSeconds * 1000 });
      return true;
    }
    a.n++;
    return a.n <= max;
  },

  async updateProfile(userId, patch: ProfilePatch) {
    const u = userById(userId);
    if (patch.username && db().users.some((x) => x.id !== userId && x.username === patch.username!.toLowerCase()))
      throw new DataError("conflict", "username");
    Object.assign(u, { ...patch, ...(patch.username ? { username: patch.username.toLowerCase() } : {}) });
    commit();
    return toProfile(u);
  },

  async setTheme(userId, theme: Theme) {
    await this.updateProfile(userId, { theme });
  },

  async getDay(userId, date) {
    const log = findLog(userId, date);
    return log && stripLog(log);
  },

  async previousActiveDay(userId, date) {
    const log = db()
      .logs.filter((l) => l.userId === userId && l.date < date && l.quarters.some((q) => q.quality))
      .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    return log && stripLog(log);
  },

  async setQuality(userId, date, rub, quality: Quality | null) {
    const log = ensureLog(userId, date);
    let row = log.quarters.find((q) => q.rub === rub);
    if (!row) {
      row = { rub, planned: false, quality: null, completedAt: null };
      log.quarters.push(row);
    }
    row.quality = quality;
    row.completedAt = quality ? (row.completedAt ?? new Date().toISOString()) : null;
    dropEmptyRows(log);
    commit();
  },

  async savePlan(userId, date, rubs, locked) {
    const set = new Set(rubs);
    const log = ensureLog(userId, date);
    for (const q of log.quarters) q.planned = set.has(q.rub);
    for (const r of set) if (!log.quarters.some((q) => q.rub === r)) log.quarters.push({ rub: r, planned: true, quality: null, completedAt: null });
    log.planLocked = locked && set.size > 0;
    dropEmptyRows(log);
    commit();
  },

  async setDailyTarget(userId, target, today) {
    await this.updateProfile(userId, { dailyTarget: target });
    const log = findLog(userId, today);
    if (log && !log.quarters.some((q) => q.quality)) {
      log.target = target;
      commit();
    }
  },

  async deleteDay(userId, date) {
    const d = db();
    const log = findLog(userId, date);
    d.logs = d.logs.filter((l) => l !== log);
    commit();
    return log && stripLog(log);
  },

  async restoreDay(userId, day) {
    const d = db();
    d.logs = d.logs.filter((l) => !(l.userId === userId && l.date === day.date));
    d.logs.push({ ...day, userId, updatedAt: new Date().toISOString() });
    commit();
  },

  async resetAllLogs(userId) {
    const d = db();
    d.logs = d.logs.filter((l) => l.userId !== userId);
    commit();
  },

  async listDays(userId): Promise<DaySummary[]> {
    return db()
      .logs.filter((l) => l.userId === userId && l.quarters.length)
      .map((l) => summarize(stripLog(l)))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  },
};

/** Two weeks of believable history ending yesterday. Shared by both backends. */
export function demoDays(today: ISODate): DayLog[] {
  const pattern = [4, 4, 5, 0, 4, 3, 4, 4, 6, 4, 2, 4, 4]; // oldest first
  const qualities: Quality[] = ["good", "good", "average", "good", "needs_work", "good"];
  let rub = 1;
  const days: DayLog[] = [];
  pattern.forEach((count, i) => {
    if (!count) return;
    const date = addDays(today, i - pattern.length);
    const quarters = Array.from({ length: count }, () => {
      const q = { rub, planned: false, quality: qualities[(rub + i) % qualities.length], completedAt: `${date}T06:00:00.000Z` };
      rub = (rub % TOTAL_QUARTERS) + 1;
      return q;
    });
    days.push({ date, target: 4, planLocked: false, quarters });
  });
  return days;
}
