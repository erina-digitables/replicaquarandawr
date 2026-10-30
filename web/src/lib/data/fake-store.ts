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

// The e2e server points this elsewhere so tests never touch your dev data.
const dir = process.env.DAWR_DATA_DIR || join(process.cwd(), ".data");
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

/**
 * Write-through after every mutation. Rename makes the write atomic. Windows refuses
 * the rename while another program has the file open (antivirus, an editor), so it
 * retries for up to about a second before giving up (BUG-002).
 */
export function commit() {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(db()));
  for (let attempt = 0; ; attempt++) {
    try {
      renameSync(tmp, file);
      return;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if ((code !== "EPERM" && code !== "EBUSY" && code !== "EACCES") || attempt >= 40) throw e;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
    }
  }
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
