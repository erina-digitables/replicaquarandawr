"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { backend } from "@/lib/data";
import { todayIn } from "@/lib/dates";
import { fieldErrors, formObject, identifier as identifierSchema, password, resetCode, signUpForm, timezone } from "@/lib/validation";

export type FormState = {
  error?: string;
  fields?: Record<string, string>;
  values?: Record<string, string>;
  notice?: string;
} | null;

/** Who the reset code is for lives in a short-lived http-only cookie, never in the URL. */
const RESET_COOKIE = "dawr_reset_for";

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

async function allowed(kind: string, subject: string, max: number, windowSeconds: number) {
  const ip = await clientIp();
  const [bySubject, byIp] = await Promise.all([
    backend.rateLimit(`${kind}:s:${subject.toLowerCase()}`, max, windowSeconds),
    backend.rateLimit(`${kind}:ip:${ip}`, max * 4, windowSeconds),
  ]);
  return bySubject && byIp;
}

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const raw = formObject(form);
  const id = identifierSchema.safeParse(raw.identifier);
  const values = { identifier: String(raw.identifier ?? "").trim() };
  if (!id.success || !raw.password) return { error: "Enter your username or email and your password.", values };
  if (!(await allowed("signin", id.data, 8, 600))) return { error: "Too many tries. Wait a few minutes and try again.", values };
  const result = await backend.signIn(id.data, raw.password);
  if (result === "invalid") return { error: "That username or password isn't right.", values };
  if (result === "unconfirmed") return { error: "Confirm your email first: open the link we sent when you signed up.", values };
  redirect("/today");
}

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  const raw = formObject(form);
  const values = { fullName: raw.fullName ?? "", username: raw.username ?? "", email: raw.email ?? "" };
  const parsed = signUpForm.safeParse(raw);
  if (!parsed.success) return { fields: fieldErrors(parsed.error), values };
  if (!(await allowed("signup", "any", 5, 3600))) return { error: "Too many new accounts from here. Try again later.", values };
  const result = await backend.signUp(parsed.data);
  if (!result.ok) return { fields: { [result.field]: result.message }, values };
  if (result.confirmEmail) return { notice: "Almost there. Open the link we just emailed you to confirm your address, then sign in." };
  redirect("/today");
}

export async function startDemo(form: FormData) {
  const tz = timezone.catch("UTC").parse(form.get("timezone"));
  if (!(await allowed("demo", "any", 10, 3600))) redirect("/signin?demo=busy");
  await backend.startDemo(tz, todayIn(tz));
  redirect("/today");
}

export async function requestReset(_: FormState, form: FormData): Promise<FormState> {
  const id = identifierSchema.safeParse(form.get("identifier"));
  const values = { identifier: String(form.get("identifier") ?? "").trim() };
  if (!id.success) return { error: "Enter your username or email.", values };
  if (!(await allowed("reset", id.data, 3, 900))) return { error: "Too many requests. Wait a few minutes and try again.", values };
  await backend.requestPasswordReset(id.data);
  (await cookies()).set(RESET_COOKIE, id.data, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/forgot",
    maxAge: 15 * 60,
  });
  redirect("/forgot/code");
}

export async function resetWithCode(_: FormState, form: FormData): Promise<FormState> {
  const raw = formObject(form);
  const jar = await cookies();
  const who = jar.get(RESET_COOKIE)?.value ?? raw.identifier ?? "";
  const values = { identifier: raw.identifier ?? "", code: raw.code ?? "" };
  const id = identifierSchema.safeParse(who);
  if (!id.success) return { fields: { identifier: "Enter your username or email." }, values };
  const code = resetCode.safeParse(raw.code ?? "");
  if (!code.success) return { fields: { code: code.error.issues[0].message }, values };
  const pw = password.safeParse(raw.password ?? "");
  if (!pw.success) return { fields: { password: pw.error.issues[0].message }, values };
  if (!(await allowed("reset-code", id.data, 5, 900))) return { error: "Too many tries. Ask for a new code in a few minutes.", values };
  const ok = await backend.resetPassword(id.data, code.data, pw.data);
  if (!ok) return { error: "That code is wrong or has expired. Ask for a new one.", values };
  jar.delete({ name: RESET_COOKIE, path: "/forgot" });
  return { notice: "Password changed. Sign in with your new password." };
}

/** Whether the reset screen already knows who the code is for (so it can hide that field). */
export async function hasPendingReset() {
  return !!(await cookies()).get(RESET_COOKIE)?.value;
}

export async function signOut() {
  await backend.signOut();
  redirect("/signin");
}
