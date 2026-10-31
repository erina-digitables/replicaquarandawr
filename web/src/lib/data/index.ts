// The data layer entry point. Picks the backend once per process: your own
// Postgres when DATABASE_URL is set, else Supabase when its env vars are set,
// otherwise the file-based dev backend.
import { emailConfigured } from "@/lib/email";
import type { Backend } from "./backend";
import { fakeBackend } from "./fake";
import { postgresBackend, postgresConfigured } from "./postgres";
import { supabaseBackend, supabaseConfigured } from "./supabase";

export * from "./types";
export type * from "./backend";

const production = process.env.NODE_ENV === "production";

if (!postgresConfigured() && !supabaseConfigured() && production && !process.env.DAWR_ALLOW_FAKE_BACKEND) {
  // A production build on the file backend would lose data on every deploy.
  throw new Error("No database is configured. Set DATABASE_URL or the Supabase variables in .env.example, or DAWR_ALLOW_FAKE_BACKEND=1 for a local production test.");
}
if (postgresConfigured() && production && !emailConfigured()) {
  // Without email nobody could confirm an account or reset a password.
  throw new Error("Email is not configured. Set RESEND_API_KEY and EMAIL_FROM (see .env.example).");
}

export const backend: Backend = postgresConfigured() ? postgresBackend : supabaseConfigured() ? supabaseBackend : fakeBackend;
