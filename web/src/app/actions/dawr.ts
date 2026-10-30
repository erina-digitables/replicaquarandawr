"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { backend, DataError, type DayLog, type Quality, type Theme } from "@/lib/data";
import type { ISODate } from "@/lib/dates";
import { requireUser, THEME_COOKIE, userToday } from "@/lib/session";
import * as v from "@/lib/validation";

/** Parse the day from the browser and refuse anything in the future. */
async function dayFor(date: unknown) {
  const user = await requireUser();
  const d = v.date.parse(date);
  if (d > userToday(user)) throw new Error("Invalid date");
  return { user, date: d as ISODate };
}

function refresh() {
  revalidatePath("/", "layout");
}

export async function rateQuarter(date: string, rub: number, quality: Quality | null) {
  const { user, date: d } = await dayFor(date);
  await backend.setQuality(user.id, d, v.rub.parse(rub), v.quality.nullable().parse(quality));
  refresh();
}

export async function savePlan(date: string, rubs: number[], locked: boolean) {
  const { user, date: d } = await dayFor(date);
  const list = [...new Set(z.array(v.rub).max(240).parse(rubs))].sort((a, b) => a - b);
  await backend.savePlan(user.id, d, list, z.boolean().parse(locked));
  refresh();
}

export async function startReading(date: string, rubs: number[]) {
  await savePlan(date, rubs, true);
  redirect(`/today?date=${v.date.parse(date)}`);
}

export async function setDailyTarget(target: number) {
  const user = await requireUser();
  await backend.setDailyTarget(user.id, v.target.parse(target), userToday(user));
  refresh();
}

export async function deleteDay(date: string): Promise<DayLog | undefined> {
  const { user, date: d } = await dayFor(date);
  const removed = await backend.deleteDay(user.id, d);
  refresh();
  return removed;
}

/** Undo for deleteDay. The snapshot round-trips through the browser, so it is parsed like any input. */
export async function restoreDay(day: DayLog) {
  const parsed = v.dayLog.parse(day);
  const { user } = await dayFor(parsed.date);
  parsed.quarters = parsed.quarters
    .filter((q) => q.planned || q.quality)
    .map((q) => ({ ...q, completedAt: q.quality ? (q.completedAt ?? new Date().toISOString()) : null }));
  await backend.restoreDay(user.id, parsed);
  refresh();
}

export type SettingsState = { ok?: string; error?: string; fields?: Record<string, string> } | null;

export async function updateAccount(_: SettingsState, form: FormData): Promise<SettingsState> {
  const user = await requireUser();
  const parsed = v.accountForm.safeParse(v.formObject(form));
  if (!parsed.success) return { fields: v.fieldErrors(parsed.error) };
  try {
    await backend.updateProfile(user.id, parsed.data);
  } catch (e) {
    if (e instanceof DataError && e.code === "conflict") return { fields: { username: "That username is taken." } };
    throw e;
  }
  refresh();
  return { ok: "Saved" };
}

export async function changePassword(_: SettingsState, form: FormData): Promise<SettingsState> {
  const user = await requireUser();
  const current = String(form.get("current") ?? "");
  const next = v.password.safeParse(form.get("next"));
  if (!next.success) return { fields: { next: next.error.issues[0].message } };
  if (!(await backend.rateLimit(`password:${user.id}`, 5, 900))) return { error: "Too many tries. Wait a few minutes." };
  const ok = await backend.changePassword(user.id, current, next.data);
  return ok ? { ok: "Password changed" } : { fields: { current: "That isn't your current password." } };
}

export async function setTheme(theme: Theme) {
  const user = await requireUser();
  const t = v.theme.parse(theme);
  await backend.setTheme(user.id, t);
  (await cookies()).set(THEME_COOKIE, t, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  refresh();
}

export async function resetAllLogs(_: SettingsState, form: FormData): Promise<SettingsState> {
  const user = await requireUser();
  if (String(form.get("confirm") ?? "").trim() !== "RESET") return { fields: { confirm: "Type RESET in capitals to confirm." } };
  await backend.resetAllLogs(user.id);
  refresh();
  return { ok: "All revision logs deleted" };
}

export async function deleteAccount(_: SettingsState, form: FormData): Promise<SettingsState> {
  const user = await requireUser();
  if (String(form.get("confirm") ?? "").trim().toLowerCase() !== user.username) return { fields: { confirm: `Type ${user.username} to confirm.` } };
  await backend.deleteAccount(user.id);
  redirect("/signup");
}
