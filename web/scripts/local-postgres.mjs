// A real Postgres on this machine, for development and the e2e suite, with the
// same roles your server gets in replica/vultr.md step 2.4. Local only: it listens
// on 127.0.0.1 and the passwords below are for this throwaway database.
//   npm run db:local          keeps its data in .pg-local/ (then: npm run db:migrate)
//   node scripts/local-postgres.mjs --e2e   empty, in .pg-e2e/, for the e2e suite
import EmbeddedPostgres from "embedded-postgres";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const e2e = process.argv.includes("--e2e");
const root = join(import.meta.dirname, "..");
const databaseDir = join(root, e2e ? ".pg-e2e" : ".pg-local");
const LOCAL = { port: e2e ? 54330 : 54329, superPassword: "local-super", ownerPassword: "local-owner", appPassword: "local-app" };

if (e2e) rmSync(databaseDir, { recursive: true, force: true });
const fresh = !existsSync(databaseDir);

const server = new EmbeddedPostgres({
  databaseDir,
  user: "postgres",
  password: LOCAL.superPassword,
  port: LOCAL.port,
  persistent: !e2e,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  postgresFlags: ["-c", "listen_addresses=127.0.0.1"],
  onLog: () => {},
});

if (fresh) await server.initialise();
await server.start();

if (fresh) {
  const c = server.getPgClient();
  await c.connect();
  // One statement per query: create database can't run inside a transaction block.
  for (const sql of [
    "create role anon nologin",
    "create role authenticated nologin",
    `create role dawr_owner login password '${LOCAL.ownerPassword}'`,
    `create role dawr_app login password '${LOCAL.appPassword}'`,
    "grant authenticated to dawr_app",
    "create database dawr owner dawr_owner",
  ])
    await c.query(sql);
  await c.end();
}

console.log(`Postgres ready on 127.0.0.1:${LOCAL.port}`);
console.log(`  DATABASE_URL=postgres://dawr_app:${LOCAL.appPassword}@127.0.0.1:${LOCAL.port}/dawr`);
console.log(`  MIGRATE_DATABASE_URL=postgres://dawr_owner:${LOCAL.ownerPassword}@127.0.0.1:${LOCAL.port}/dawr`);

const stop = async () => {
  await server.stop().catch(() => {});
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30); // stay up until stopped
