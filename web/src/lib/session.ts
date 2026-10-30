import { redirect } from "next/navigation";
import { cache } from "react";
import { backend, type Profile } from "@/lib/data";
import { isValidDate, todayIn, type ISODate } from "@/lib/dates";

export const THEME_COOKIE = "dawr_theme";

/** The signed-in user, once per request. */
export const currentUser = cache(async (): Promise<Profile | null> => backend.currentUser());

export async function requireUser(): Promise<Profile> {
  const user = await currentUser();
  if (!user) redirect("/signin");
  return user;
}

/** "Today" is always the user's own calendar day, worked out on the server. */
export function userToday(user: Profile): ISODate {
  return todayIn(user.timezone);
}

/** A date from the URL, clamped to today (no logging the future). */
export function pickDate(user: Profile, raw: string | string[] | undefined): ISODate {
  const today = userToday(user);
  const d = typeof raw === "string" && isValidDate(raw) ? raw : today;
  return d > today ? today : d;
}
