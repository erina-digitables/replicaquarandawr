// Development stand-in for Supabase: one JSON file on disk, so data survives
// dev-server restarts. replica-backend replaces this module; the functions in
// ./index.ts keep their signatures, so no screen code changes.
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { DayLog, Profile } from "./types";

type UserRow = Profile & { passwordHash: string };
type SessionRow = { token: string; userId: string; expiresAt: number };
type ResetRow = { userId: string; code: string; expiresAt: number; attempts: number };
type LogRow = DayLog & { userId: string; updatedAt: string };

type DB = { users: UserRow[]; sessions: SessionRow[]; resets: ResetRow[]; logs: LogRow[] };

const dir = join(process.cwd(), ".data");
const file = join(dir, "dev-db.json");

const g = globalThis as unknown as { __dawrDb?: DB };

export function db(): DB {
  if (!g.__dawrDb) {
    g.__dawrDb = existsSync(file)
      ? (JSON.parse(readFileSync(file, "utf8")) as DB)
      : { users: [], sessions: [], resets: [], logs: [] };
  }
  return g.__dawrDb;
}

/** Write-through after every mutation. Rename makes the write atomic. */
export function commit() {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(db()));
  renameSync(tmp, file);
}

export const newId = () => randomUUID();
export const newToken = () => randomBytes(32).toString("base64url");

export function hashPassword(password: string) {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function checkPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  const a = Buffer.from(hash, "hex");
  const b = scryptSync(password, Buffer.from(salt, "hex"), 64);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type { DB, LogRow, ResetRow, SessionRow, UserRow };
