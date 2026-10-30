// The data layer. Every screen and action goes through these functions only.
// Today they run on the fake store; replica-backend swaps the bodies for
// Supabase calls (RLS does the user_id scoping that these functions do by hand).
import { randomInt } from "node:crypto";
import { addDays, type ISODate } from "@/lib/dates";
import { summarize } from "@/lib/dawr";
import { TOTAL_QUARTERS } from "@/lib/quarters";
import { checkPassword, commit, db, hashPassword, newId, newToken, type LogRow, type UserRow } from "./fake-store";
import { DataError, type DayLog, type DaySummary, type Profile, type Quality, type Theme } from "./types";

export * from "./types";

const SESSION_DAYS = 30;
const RESET_MINUTES = 15;

function toProfile(u: UserRow): Profile {
  // never let the hash out of the data layer
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

// ---------------------------------------------------------------- auth

export async function createUser(input: {
  fullName: string;
  username: string;
  email: string;
  password: string;
  timezone: string;
  isDemo?: boolean;
}): Promise<Profile> {
  const d = db();
  if (d.users.some((u) => u.username.toLowerCase() === input.username.toLowerCase()))
    throw new DataError("conflict", "username");
  if (d.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) throw new DataError("conflict", "email");
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
  d.users.push(row);
  commit();
  return toProfile(row);
}

/** Username or email. Returns null for both "no such user" and "wrong password". */
export async function verifyCredentials(identifier: string, password: string): Promise<Profile | null> {
  const u = findByIdentifier(identifier);
  if (!u || !checkPassword(password, u.passwordHash)) return null;
  return toProfile(u);
}

export async function createSession(userId: string) {
  const token = newToken();
  const expiresAt = Date.now() + SESSION_DAYS * 864e5;
  db().sessions.push({ token, userId, expiresAt });
  commit();
  return { token, expiresAt };
}

export async function getSessionUser(token: string | undefined): Promise<Profile | null> {
  if (!token) return null;
  const s = db().sessions.find((x) => x.token === token && x.expiresAt > Date.now());
  if (!s) return null;
  const u = db().users.find((x) => x.id === s.userId);
  return u ? toProfile(u) : null;
}

export async function deleteSession(token: string) {
  const d = db();
  d.sessions = d.sessions.filter((s) => s.token !== token);
  commit();
}

/**
 * Creates a 6-digit reset code. Returns where it would be emailed, or null if
 * the account does not exist (the caller must not reveal which).
 */
export async function createResetCode(identifier: string): Promise<{ email: string; code: string } | null> {
  const u = findByIdentifier(identifier);
  if (!u) return null;
  const d = db();
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  d.resets = d.resets.filter((r) => r.userId !== u.id);
  d.resets.push({ userId: u.id, code, expiresAt: Date.now() + RESET_MINUTES * 6e4, attempts: 0 });
  commit();
  return { email: u.email, code };
}

/** Checks the code and sets the new password in one step. */
export async function resetPassword(identifier: string, code: string, newPassword: string): Promise<boolean> {
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
  d.sessions = d.sessions.filter((s) => s.userId !== u.id); // sign out everywhere
  commit();
  return true;
}

export async function changePassword(userId: string, current: string, next: string) {
  const u = userById(userId);
  if (!checkPassword(current, u.passwordHash)) return false;
  u.passwordHash = hashPassword(next);
  commit();
  return true;
}

export async function deleteAccount(userId: string) {
  const d = db();
  d.users = d.users.filter((u) => u.id !== userId);
  d.sessions = d.sessions.filter((s) => s.userId !== userId);
  d.resets = d.resets.filter((r) => r.userId !== userId);
  d.logs = d.logs.filter((l) => l.userId !== userId);
  commit();
}

// ---------------------------------------------------------------- profile

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<Profile, "fullName" | "username" | "dailyTarget" | "timezone" | "theme">>,
): Promise<Profile> {
  const u = userById(userId);
  if (patch.username && db().users.some((x) => x.id !== userId && x.username === patch.username!.toLowerCase()))
    throw new DataError("conflict", "username");
  if (patch.dailyTarget !== undefined && (patch.dailyTarget < 1 || patch.dailyTarget > TOTAL_QUARTERS))
    throw new DataError("invalid", "dailyTarget");
  Object.assign(u, {
    ...patch,
    ...(patch.username ? { username: patch.username.toLowerCase() } : {}),
  });
  commit();
  return toProfile(u);
}

export async function setTheme(userId: string, theme: Theme) {
  return updateProfile(userId, { theme });
}

// ---------------------------------------------------------------- days

function stripLog({ date, target, planLocked, quarters }: LogRow): DayLog {
  return { date, target, planLocked, quarters: quarters.map((q) => ({ ...q })) };
}

function findLog(userId: string, date: ISODate) {
  return db().logs.find((l) => l.userId === userId && l.date === date);
}

/** Gets or creates the day, snapshotting today's target (one log per user per day). */
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

export async function getDay(userId: string, date: ISODate): Promise<DayLog | undefined> {
  const log = findLog(userId, date);
  return log && stripLog(log);
}

/** The most recent day before `date` with anything completed (drives the suggestion). */
export async function previousActiveDay(userId: string, date: ISODate): Promise<DayLog | undefined> {
  const log = db()
    .logs.filter((l) => l.userId === userId && l.date < date && l.quarters.some((q) => q.quality))
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  return log && stripLog(log);
}

/** Idempotent: rating the same quarter twice updates it in place. null clears it. */
export async function setQuality(userId: string, date: ISODate, rub: number, quality: Quality | null): Promise<DayLog> {
  if (rub < 1 || rub > TOTAL_QUARTERS) throw new DataError("invalid", "rub");
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
  return stripLog(log);
}

/** Replaces the planned set; completed quarters stay. */
export async function savePlan(userId: string, date: ISODate, rubs: number[], locked: boolean): Promise<DayLog> {
  const set = new Set(rubs.filter((r) => r >= 1 && r <= TOTAL_QUARTERS));
  const log = ensureLog(userId, date);
  for (const q of log.quarters) q.planned = set.has(q.rub);
  for (const r of set) if (!log.quarters.some((q) => q.rub === r)) log.quarters.push({ rub: r, planned: true, quality: null, completedAt: null });
  log.planLocked = locked && set.size > 0;
  dropEmptyRows(log);
  commit();
  return stripLog(log);
}

/** Changing the goal also updates today's snapshot while nothing is completed yet. */
export async function setDailyTarget(userId: string, target: number, today: ISODate) {
  const p = await updateProfile(userId, { dailyTarget: target });
  const log = findLog(userId, today);
  if (log && !log.quarters.some((q) => q.quality)) {
    log.target = target;
    commit();
  }
  return p;
}

export async function deleteDay(userId: string, date: ISODate): Promise<DayLog | undefined> {
  const d = db();
  const log = findLog(userId, date);
  d.logs = d.logs.filter((l) => l !== log);
  commit();
  return log && stripLog(log);
}

/** Undo for deleteDay. */
export async function restoreDay(userId: string, day: DayLog) {
  const d = db();
  d.logs = d.logs.filter((l) => !(l.userId === userId && l.date === day.date));
  d.logs.push({ ...day, userId, updatedAt: new Date().toISOString() });
  commit();
}

export async function resetAllLogs(userId: string) {
  const d = db();
  d.logs = d.logs.filter((l) => l.userId !== userId);
  commit();
}

export async function listDays(userId: string): Promise<DaySummary[]> {
  return db()
    .logs.filter((l) => l.userId === userId && l.quarters.length)
    .map((l) => summarize(stripLog(l)))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

// ---------------------------------------------------------------- demo

/** A throwaway account with two weeks of believable history. */
export async function createDemoUser(timezone: string, today: ISODate): Promise<Profile> {
  const tag = newId().slice(0, 8);
  const p = await createUser({
    fullName: "Demo reader",
    username: `demo_${tag}`,
    email: `demo_${tag}@demo.invalid`,
    password: newToken(),
    timezone,
    isDemo: true,
  });
  const pattern = [4, 4, 5, 0, 4, 3, 4, 4, 6, 4, 2, 4, 4]; // oldest first, ends yesterday
  const qualities: Quality[] = ["good", "good", "average", "good", "needs_work", "good"];
  let rub = 1;
  pattern.forEach((count, i) => {
    const date = addDays(today, i - pattern.length);
    if (!count) return;
    const log = ensureLog(p.id, date);
    for (let k = 0; k < count; k++) {
      log.quarters.push({ rub, planned: false, quality: qualities[(rub + i) % qualities.length], completedAt: `${date}T06:00:00.000Z` });
      rub = (rub % TOTAL_QUARTERS) + 1;
    }
  });
  commit();
  return p;
}
