// Every input from the browser is parsed here before it reaches the backend.
import { z } from "zod";
import { isValidDate } from "./dates";

export const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,24}$/, "3-24 characters: lowercase letters, numbers and _.");
export const email = z.string().trim().toLowerCase().max(254).email("Enter an email like name@example.com.");
export const password = z.string().min(8, "Use at least 8 characters.").max(72, "Keep it under 72 characters.");
export const fullName = z.string().trim().min(1, "Tell us what to call you.").max(80, "Keep it under 80 characters.");
export const identifier = z.string().trim().min(1, "Enter your username or email.").max(254);
export const timezone = z
  .string()
  .max(64)
  .refine((tz) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Pick a time zone from the list.");
export const date = z.string().refine(isValidDate, "Invalid date");
export const rub = z.number().int().min(1).max(240);
export const quality = z.enum(["good", "average", "needs_work"]);
export const target = z.number().int().min(1).max(240);
export const theme = z.enum(["system", "light", "dark"]);
export const resetCode = z
  .string()
  .transform((s) => s.replace(/\s/g, ""))
  .pipe(z.string().regex(/^\d{6}$/, "The code is 6 digits."));

export const signUpForm = z.object({ fullName, username, email, password, timezone: timezone.catch("UTC") });
export const accountForm = z.object({ fullName, username, timezone });

export const dayLog = z.object({
  date,
  target,
  planLocked: z.boolean(),
  quarters: z
    .array(
      z.object({
        rub,
        planned: z.boolean(),
        quality: quality.nullable(),
        completedAt: z.string().datetime().nullable(),
      }),
    )
    .max(240),
});

/** FormData -> plain object of strings, for zod. */
export function formObject(form: FormData) {
  return Object.fromEntries([...form.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""]));
}

/** First error message per field. */
export function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
