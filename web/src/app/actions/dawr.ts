"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as data from "@/lib/data";
import { isValidDate, type ISODate } from "@/lib/dates";
import { requireUser, SESSION_COOKIE, THEME_COOKIE, userToday } from "@/lib/session";
import type { DayLog, Quality, Theme } from "@/lib/data";

async function dayFor(date: unknown) {
  const user = await requireUser();
  if (!isValidDate(date) || date > userToday(user)) throw new Error("Invalid date");
  return { user, date: date as ISODate };
}

function refresh() {
  revalidatePath("/", "layout");
}

const QUALITIES = new Set<Quality>(["good", "average", "needs_work"]);

export async function rateQuarter(date: string, rub: number, quality: Quality | null) {
  const { user } = await dayFor(date);
  if (quality !== null && !QUALITIES.has(quality)) throw new Error("Invalid quality");
  const day = await data.setQuality(user.id, date, rub, quality);
  refresh();
  return day;
}

export async function savePlan(date: string, rubs: number[], locked: boolean) {
  const { user } = await dayFor(date);
  await data.savePlan(user.id, date, rubs, locked);
  refresh();
}

export async function startReading(date: string, rubs: number[]) {
  await savePlan(date, rubs, true);
  redirect(`/today?date=${date}`);
}

export async function setDailyTarget(target: number) {
  const user = await requireUser();
  if (!Number.isInteger(target) || target < 1 || target > 240) throw new Error("Invalid target");
  await data.setDailyTarget(user.id, target, userToday(user));
  refresh();
}

export async function deleteDay(date: string): Promise<DayLog | undefined> {
  const { user } = await dayFor(date);
  const removed = await data.deleteDay(user.id, date);
  refresh();
  return removed;
}

export async function restoreDay(day: DayLog) {
  const { user } = await dayFor(day.date);
  // The snapshot round-trips through the browser, so rebuild it from known-good fields only.
  const clean: DayLog = {
    date: day.date,
    target: Number.isInteger(day.target) && day.target >= 1 && day.target <= 240 ? day.target : user.dailyTarget,
    planLocked: !!day.planLocked,
    quarters: (Array.isArray(day.quarters) ? day.quarters : [])
      .filter((q) => Number.isInteger(q.rub) && q.rub >= 1 && q.rub <= 240)
      .map((q) => ({
        rub: q.rub,
        planned: !!q.planned,
        quality: q.quality && QUALITIES.has(q.quality) ? q.quality : null,
        completedAt: q.quality && QUALITIES.has(q.quality) ? (q.completedAt ?? new Date().toISOString()) : null,
      }))
      .filter((q) => q.planned || q.quality),
  };
  await data.restoreDay(user.id, clean);
  refresh();
}

export type SettingsState = { ok?: string; error?: string; fields?: Record<string, string> } | null;

export async function updateAccount(_: SettingsState, form: FormData): Promise<SettingsState> {
  const user = await requireUser();
  const fullName = String(form.get("fullName") ?? "").trim();
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const timezone = String(form.get("timezone") ?? "");
  const fields: Record<string, string> = {};
  if (!fullName || fullName.length > 80) fields.fullName = "1-80 characters.";
  if (!/^[a-z0-9_]{3,24}$/.test(username)) fields.username = "3-24 characters: lowercase letters, numbers and _.";
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
  } catch {
    fields.timezone = "Pick a time zone from the list.";
  }
  if (Object.keys(fields).length) return { fields };
  try {
    await data.updateProfile(user.id, { fullName, username, timezone });
  } catch (e) {
    if (e instanceof data.DataError && e.code === "conflict") return { fields: { username: "That username is taken." } };
    throw e;
  }
  refresh();
  return { ok: "Saved" };
}

export async function changePassword(_: SettingsState, form: FormData): Promise<SettingsState> {
  const user = await requireUser();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  if (next.length < 8) return { fields: { next: "Use at least 8 characters." } };
  const ok = await data.changePassword(user.id, current, next);
  return ok ? { ok: "Password changed" } : { fields: { current: "That isn't your current password." } };
}

export async function setTheme(theme: Theme) {
  const user = await requireUser();
  if (!["system", "light", "dark"].includes(theme)) throw new Error("Invalid theme");
  await data.setTheme(user.id, theme);
  (await cookies()).set(THEME_COOKIE, theme, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  refresh();
}

export async function resetAllLogs(_: SettingsState, form: FormData): Promise<SettingsState> {
  const user = await requireUser();
  if (String(form.get("confirm") ?? "").trim() !== "RESET") return { fields: { confirm: "Type RESET in capitals to confirm." } };
  await data.resetAllLogs(user.id);
  refresh();
  return { ok: "All revision logs deleted" };
}

export async function deleteAccount(_: SettingsState, form: FormData): Promise<SettingsState> {
  const user = await requireUser();
  if (String(form.get("confirm") ?? "").trim().toLowerCase() !== user.username) return { fields: { confirm: `Type ${user.username} to confirm.` } };
  await data.deleteAccount(user.id);
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/signup");
}
