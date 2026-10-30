import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getSessionUser, type Profile } from "@/lib/data";
import { isValidDate, todayIn, type ISODate } from "@/lib/dates";

export const SESSION_COOKIE = "dawr_session";
export const THEME_COOKIE = "dawr_theme";

export const currentUser = cache(async (): Promise<Profile | null> => {
  const jar = await cookies();
  return getSessionUser(jar.get(SESSION_COOKIE)?.value);
});

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
