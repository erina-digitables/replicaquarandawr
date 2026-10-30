// Supabase clients. Server-only: the browser never talks to Supabase directly,
// so auth cookies can be http-only and the anon key never needs to ship.
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export function env() {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) throw new Error("Supabase env vars missing (see .env.example)");
  return { url, anon, service };
}

export const hardenCookie = (options: CookieOptions): CookieOptions => ({
  ...options,
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
});

/** Acts as the signed-in user: every query goes through row level security. */
export async function userClient() {
  const { url, anon } = env();
  const jar = await cookies();
  return createServerClient(url, anon, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) jar.set(name, value, hardenCookie(options));
        } catch {
          // Server components cannot set cookies; middleware.ts refreshes the session instead.
        }
      },
    },
  });
}

/** Bypasses row level security. Only for the few jobs that need it, never with user input as a filter alone. */
export function adminClient() {
  const { url, service } = env();
  return createPlainClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** A throwaway client that holds no cookies, for checking a password without touching the session. */
export function scratchClient() {
  const { url, anon } = env();
  return createPlainClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
}
