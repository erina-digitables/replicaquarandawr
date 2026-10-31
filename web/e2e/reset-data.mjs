// Fresh, empty test data for every run. Only ever touches .data-e2e/ and .mail-e2e/,
// or, with --postgres, the throwaway e2e database (scripts/local-postgres.mjs --e2e
// starts it empty), which it then migrates.
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import pg from "pg";

rmSync(new URL("../.data-e2e", import.meta.url), { recursive: true, force: true });
rmSync(new URL("../.mail-e2e", import.meta.url), { recursive: true, force: true });

if (process.argv.includes("--postgres")) {
  const url = process.env.MIGRATE_DATABASE_URL;
  // The database server may still be starting.
  for (let i = 0; ; i++) {
    const c = new pg.Client({ connectionString: url });
    try {
      await c.connect();
      await c.end();
      break;
    } catch (e) {
      if (i > 120) throw e;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  execFileSync(process.execPath, ["scripts/migrate.mjs"], { stdio: "inherit" });
}
