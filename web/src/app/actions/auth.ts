"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createDemoUser,
  createResetCode,
  createSession,
  createUser,
  DataError,
  deleteSession,
  resetPassword,
  verifyCredentials,
} from "@/lib/data";
import { todayIn } from "@/lib/dates";
import { SESSION_COOKIE } from "@/lib/session";

export type FormState = {
  error?: string;
  fields?: Record<string, string>;
  values?: Record<string, string>;
  notice?: string;
} | null;

const USERNAME = /^[a-z0-9_]{3,24}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function safeTimezone(tz: FormDataEntryValue | null) {
  const value = typeof tz === "string" ? tz : "";
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return value || "UTC";
  } catch {
    return "UTC";
  }
}

async function startSession(userId: string) {
  const { token, expiresAt } = await createSession(userId);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

// Naive per-process limiter so the fake layer behaves like the real one will (architecture: rate limits).
const attempts = new Map<string, { n: number; until: number }>();
function limited(key: string, max = 8, windowMs = 10 * 60_000) {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || a.until < now) {
    attempts.set(key, { n: 1, until: now + windowMs });
    return false;
  }
  a.n++;
  return a.n > max;
}

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const identifier = String(form.get("identifier") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const values = { identifier };
  if (!identifier || !password) return { error: "Enter your username or email and your password.", values };
  if (limited(`signin:${identifier.toLowerCase()}`)) return { error: "Too many tries. Wait a few minutes and try again.", values };
  const user = await verifyCredentials(identifier, password);
  if (!user) return { error: "That username or password isn't right.", values };
  await startSession(user.id);
  redirect("/today");
}

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  const values = {
    fullName: String(form.get("fullName") ?? "").trim(),
    username: String(form.get("username") ?? "").trim().toLowerCase(),
    email: String(form.get("email") ?? "").trim().toLowerCase(),
  };
  const password = String(form.get("password") ?? "");
  const fields: Record<string, string> = {};
  if (!values.fullName) fields.fullName = "Tell us what to call you.";
  else if (values.fullName.length > 80) fields.fullName = "Keep it under 80 characters.";
  if (!USERNAME.test(values.username)) fields.username = "3-24 characters: lowercase letters, numbers and _.";
  if (!EMAIL.test(values.email)) fields.email = "Enter an email like name@example.com.";
  if (password.length < 8) fields.password = "Use at least 8 characters.";
  if (Object.keys(fields).length) return { fields, values };
  try {
    const user = await createUser({ ...values, password, timezone: safeTimezone(form.get("timezone")) });
    await startSession(user.id);
  } catch (e) {
    if (e instanceof DataError && e.code === "conflict")
      return {
        fields: e.message === "username" ? { username: "That username is taken." } : { email: "There's already an account with that email." },
        values,
      };
    throw e;
  }
  redirect("/today");
}

export async function startDemo(form: FormData) {
  const tz = safeTimezone(form.get("timezone"));
  const user = await createDemoUser(tz, todayIn(tz));
  await startSession(user.id);
  redirect("/today");
}

export async function requestReset(_: FormState, form: FormData): Promise<FormState> {
  const identifier = String(form.get("identifier") ?? "").trim();
  if (!identifier) return { error: "Enter your username or email.", values: { identifier } };
  if (limited(`reset:${identifier.toLowerCase()}`, 3)) return { error: "Too many requests. Wait a few minutes and try again.", values: { identifier } };
  const sent = await createResetCode(identifier);
  // Email is not wired up yet (replica-backend: Resend). In development the code goes to the server log.
  if (sent && process.env.NODE_ENV !== "production") console.info(`[dev] reset code for ${sent.email}: ${sent.code}`);
  redirect(`/forgot/code?for=${encodeURIComponent(identifier)}`);
}

export async function resetWithCode(_: FormState, form: FormData): Promise<FormState> {
  const identifier = String(form.get("identifier") ?? "").trim();
  const code = String(form.get("code") ?? "").replace(/\s/g, "");
  const password = String(form.get("password") ?? "");
  const values = { identifier, code };
  if (!/^\d{6}$/.test(code)) return { fields: { code: "The code is 6 digits." }, values };
  if (password.length < 8) return { fields: { password: "Use at least 8 characters." }, values };
  const ok = await resetPassword(identifier, code, password);
  if (!ok) return { error: "That code is wrong or has expired. Ask for a new one.", values };
  return { notice: "Password changed. Sign in with your new password." };
}

export async function signOut() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(token);
  jar.delete(SESSION_COOKIE);
  redirect("/signin");
}
