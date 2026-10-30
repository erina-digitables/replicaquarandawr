// The data layer entry point. Picks the backend once per process:
// Supabase when its env vars are set, otherwise the file-based dev backend.
import type { Backend } from "./backend";
import { fakeBackend } from "./fake";
import { supabaseBackend, supabaseConfigured } from "./supabase";

export * from "./types";
export type * from "./backend";

if (!supabaseConfigured() && process.env.NODE_ENV === "production" && !process.env.DAWR_ALLOW_FAKE_BACKEND) {
  // A production build on the file backend would lose data on every deploy.
  throw new Error("Supabase is not configured. Set the variables in .env.example, or DAWR_ALLOW_FAKE_BACKEND=1 for a local production test.");
}

export const backend: Backend = supabaseConfigured() ? supabaseBackend : fakeBackend;
