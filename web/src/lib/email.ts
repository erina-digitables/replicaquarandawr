// Transactional email for the Postgres backend, through Resend's HTTP API.
// (On Supabase, Supabase Auth sends these itself over Resend's SMTP.)
// With DAWR_MAIL_DIR set, nothing is sent: each message is written to that folder
// as JSON instead. The e2e suite reads its codes from there.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Mail = { to: string; subject: string; html: string };

export function emailConfigured() {
  return !!(process.env.DAWR_MAIL_DIR || (process.env.RESEND_API_KEY && process.env.EMAIL_FROM));
}

/** The templates are shared with Supabase (supabase/templates), which uses Go template syntax. */
export function renderTemplate(name: "confirmation" | "recovery", vars: Record<string, string>) {
  const html = readFileSync(join(process.cwd(), "supabase", "templates", `${name}.html`), "utf8");
  return html.replace(/\{\{\s*\.(\w+)\s*\}\}/g, (m, key: string) => vars[key] ?? m);
}

export async function sendEmail(mail: Mail) {
  const dir = process.env.DAWR_MAIL_DIR;
  if (dir) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${Date.now()}-${crypto.randomUUID()}.json`), JSON.stringify(mail));
    return;
  }
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) throw new Error("email: RESEND_API_KEY and EMAIL_FROM are not set");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, html: mail.html }),
    signal: AbortSignal.timeout(10_000),
  });
  // Never log the address or the body: only the status.
  if (!res.ok) throw new Error(`email: Resend answered ${res.status}`);
}
