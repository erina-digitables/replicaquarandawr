import type { ISODate } from "@/lib/dates";
import type { DayLog, DaySummary, Profile, Quality, Theme } from "./types";

export type SignUpInput = { fullName: string; username: string; email: string; password: string; timezone: string };

export type SignUpResult =
  | { ok: true; confirmEmail?: string } // confirmEmail: the account exists but must be verified before sign-in
  | { ok: false; field: "username" | "email" | "password"; message: string };

export type SignInResult = "ok" | "invalid" | "unconfirmed";

export type ProfilePatch = Partial<Pick<Profile, "fullName" | "username" | "dailyTarget" | "timezone" | "theme">>;

/**
 * Everything the app needs from storage and auth. Two implementations:
 * fake.ts (file on disk, for development without keys) and supabase.ts.
 * Screens and server actions only ever see this interface.
 */
export interface Backend {
  readonly name: "fake" | "supabase";

  // auth (the backend owns its session cookies)
  currentUser(): Promise<Profile | null>;
  signUp(input: SignUpInput): Promise<SignUpResult>;
  signIn(identifier: string, password: string): Promise<SignInResult>;
  signOut(): Promise<void>;
  startDemo(timezone: string, today: ISODate): Promise<void>;
  /** Never reveals whether the account exists. */
  requestPasswordReset(identifier: string): Promise<void>;
  /** Checks the code, sets the password and signs out every session. */
  resetPassword(identifier: string, code: string, newPassword: string): Promise<boolean>;
  changePassword(userId: string, current: string, next: string): Promise<boolean>;
  deleteAccount(userId: string): Promise<void>;
  /** true = allowed. Counts one hit against key. */
  rateLimit(key: string, max: number, windowSeconds: number): Promise<boolean>;

  // profile
  updateProfile(userId: string, patch: ProfilePatch): Promise<Profile>;
  setTheme(userId: string, theme: Theme): Promise<void>;

  // days
  getDay(userId: string, date: ISODate): Promise<DayLog | undefined>;
  previousActiveDay(userId: string, date: ISODate): Promise<DayLog | undefined>;
  setQuality(userId: string, date: ISODate, rub: number, quality: Quality | null): Promise<void>;
  savePlan(userId: string, date: ISODate, rubs: number[], locked: boolean): Promise<void>;
  setDailyTarget(userId: string, target: number, today: ISODate): Promise<void>;
  deleteDay(userId: string, date: ISODate): Promise<DayLog | undefined>;
  restoreDay(userId: string, day: DayLog): Promise<void>;
  resetAllLogs(userId: string): Promise<void>;
  listDays(userId: string): Promise<DaySummary[]>;
}
