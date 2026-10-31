// Applies the database migrations to your own Postgres (not Supabase: there,
// `npm run db:push` does it). Runs supabase/migrations/*.sql and db/postgres/*.sql
// together in filename order, each file once, each in its own transaction.
//   npm run db:migrate
// Needs MIGRATE_DATABASE_URL: the role that owns the tables (dawr_owner).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import pg from "pg";

const root = join(import.meta.dirname, "..");
for (const f of [".env.production.local", ".env.local"]) {
  if (existsSync(join(root, f))) process.loadEnvFile(join(root, f));
}

const url = process.env.MIGRATE_DATABASE_URL;
if (!url) {
  console.error("MIGRATE_DATABASE_URL is not set (see .env.example).");
  process.exit(1);
}

const files = ["supabase/migrations", "db/postgres"]
  .flatMap((dir) => readdirSync(join(root, dir)).filter((f) => f.endsWith(".sql")).map((f) => join(root, dir, f)))
  .sort((a, b) => basename(a).localeCompare(basename(b)));

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query(`create schema if not exists meta;
    create table if not exists meta.migrations (name text primary key, applied_at timestamptz not null default now())`);
  const done = new Set((await client.query("select name from meta.migrations")).rows.map((r) => r.name));
  let applied = 0;
  for (const file of files) {
    const name = basename(file);
    if (done.has(name)) continue;
    await client.query("begin");
    try {
      await client.query(readFileSync(file, "utf8"));
      await client.query("insert into meta.migrations (name) values ($1)", [name]);
      await client.query("commit");
      console.log(`applied ${name}`);
      applied++;
    } catch (e) {
      await client.query("rollback");
      console.error(`failed ${name}: ${e.message}`);
      process.exitCode = 1;
      break;
    }
  }
  if (!process.exitCode) console.log(applied ? `${applied} migration(s) applied.` : "Database is up to date.");
} finally {
  await client.end();
}
