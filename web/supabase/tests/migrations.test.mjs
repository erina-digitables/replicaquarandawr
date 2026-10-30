// Runs every migration against embedded Postgres (PGlite) with a stand-in for
// Supabase's auth schema, then checks the rules the app depends on: constraints,
// the write functions, streaks, and that a second user can see or change nothing.
//   npm run db:test
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(import.meta.dirname, "..", "migrations");
const db = new PGlite({ extensions: { citext } });
const q = async (sql, p) => (await db.query(sql, p)).rows;
let failures = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${extra ? ` (${extra})` : ""}`);
  if (!ok) failures++;
};
const rejects = async (name, fn) => {
  try {
    await fn();
    check(name, false, "was allowed");
  } catch {
    check(name, true);
  }
};

// --- Supabase stand-ins: auth.users, auth.uid(), roles ---------------------
await db.exec(`
  create role anon; create role authenticated;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
`);
for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) await db.exec(readFileSync(join(dir, f), "utf8"));
await db.exec(`
  grant usage on schema auth to authenticated;
  grant select, insert, update, delete on profiles, daily_logs, log_quarters, quarters to authenticated;
  grant select on day_summaries to authenticated;
`);

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
await q(`insert into auth.users values ($1,'a@example.test','{"full_name":"A","username":"ahmad","timezone":"UTC"}')`, [A]);
await q(`insert into auth.users values ($1,'b@example.test','{"full_name":"B","username":"bilal","timezone":"UTC"}')`, [B]);
const as = async (uid) => db.exec(`set role authenticated; select set_config('test.uid', '${uid}', false);`);
const admin = async () => db.exec(`reset role; select set_config('test.uid', '', false);`);

console.log("schema");
check("240 quarters seeded", (await q(`select count(*)::int c from quarters`))[0].c === 240);
check("juz boundaries consistent", (await q(`select count(*)::int c from quarters where juz <> ((rub-1)/8)+1`))[0].c === 0);
check("profiles created by trigger", (await q(`select count(*)::int c from profiles`))[0].c === 2);
await rejects("duplicate username (any case) rejected", () =>
  q(`insert into auth.users values (gen_random_uuid(),'c@example.test','{"full_name":"C","username":"Ahmad"}')`),
);
check("username lookup works for the service role", (await q(`select email_for_username('AHMAD') e`))[0].e === "a@example.test");

console.log("write functions as user A");
await as(A);
const today = (await q(`select my_today()::text d`))[0].d;
function await_day(n) {
  const d = new Date(today + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
await q(`select set_quality($1, 1::smallint, 'good')`, [today]);
await q(`select set_quality($1, 1::smallint, 'average')`, [today]); // idempotent re-rate
let rows = await q(`select rub, quality, planned from log_quarters`);
check("re-rating updates in place", rows.length === 1 && rows[0].quality === "average");
await q(`select set_quality($1, 1::smallint, null)`, [today]);
check("clearing an unplanned quarter removes the row", (await q(`select count(*)::int c from log_quarters`))[0].c === 0);
await rejects("future date refused", () => q(`select set_quality($1, 1::smallint, 'good')`, [await_day(-1)]));
await rejects("bad quality refused", () => q(`select set_quality($1, 1::smallint, 'great')`, [today]));

await q(`select save_plan($1, array[5,6,7,8]::smallint[], true)`, [today]);
await q(`select set_quality($1, 5::smallint, 'good')`, [today]);
await q(`select set_quality($1, 2::smallint, 'needs_work')`, [today]);
await q(`select save_plan($1, array[6,7]::smallint[], true)`, [today]);
rows = await q(`select rub, planned, quality from log_quarters order by rub`);
check(
  "re-planning keeps completed quarters, drops unread unplanned ones",
  JSON.stringify(rows.map((r) => [r.rub, r.planned, r.quality])) ===
    JSON.stringify([[2, false, "needs_work"], [5, false, "good"], [6, true, null], [7, true, null]]),
  JSON.stringify(rows.map((r) => r.rub)),
);
check("plan locked", (await q(`select plan_locked from daily_logs where log_date=$1`, [today]))[0].plan_locked === true);
await q(`select set_quality($1, 6::smallint, null)`, [today]);
check("clearing a planned quarter keeps it planned", (await q(`select planned from log_quarters where rub=6`))[0]?.planned === true);

await q(`select set_daily_target(8::smallint)`);
check("target change does not rewrite a day already started", (await q(`select target_quarters t from daily_logs where log_date=$1`, [today]))[0].t === 4);
await q(`select set_quality($1, 9::smallint, 'good')`, [await_day(1)]);
check("new day snapshots the new target", (await q(`select target_quarters t from daily_logs where log_date=$1`, [await_day(1)]))[0].t === 8);
await q(`select set_daily_target(4::smallint)`);

console.log("streak");
await q(`delete from daily_logs`);
const fill = async (date, n) => {
  for (let r = 1; r <= n; r++) await q(`select set_quality($1, $2::smallint, 'good')`, [date, r + 20]);
};
await fill(await_day(3), 4);
await fill(await_day(1), 4);
await fill(today, 2);
check("yesterday met, today partial -> 1", (await q(`select current_streak() s`))[0].s === 1);
await fill(today, 4);
check("today met -> 2", (await q(`select current_streak() s`))[0].s === 2);

console.log("restore_day");
const snap = await q(`select rub, planned, quality, completed_at from log_quarters q join daily_logs d on d.id=q.log_id where d.log_date=$1`, [today]);
await q(`delete from daily_logs where log_date=$1`, [today]);
await q(`select restore_day($1, 4::smallint, false, $2::jsonb)`, [today, JSON.stringify(snap)]);
check("restored day has the same quarters", (await q(`select done_count::int c from day_summaries where log_date=$1`, [today]))[0].c === snap.length);
await rejects("restore with a bad quality is refused", () =>
  q(`select restore_day($1, 4::smallint, false, '[{"rub":3,"quality":"great"}]'::jsonb)`, [await_day(5)]),
);

console.log("second user (row level security)");
await as(B);
check("B sees no logs", (await q(`select count(*)::int c from daily_logs`))[0].c === 0);
check("B sees no quarters", (await q(`select count(*)::int c from log_quarters`))[0].c === 0);
check("B sees no summaries", (await q(`select count(*)::int c from day_summaries`))[0].c === 0);
check("B sees only their own profile", (await q(`select username from profiles`)).map((r) => r.username).join() === "bilal");
check("B's streak is 0", (await q(`select current_streak() s`))[0].s === 0);
const aLog = (await (async () => {
  await admin();
  const r = await q(`select id from daily_logs where user_id=$1 limit 1`, [A]);
  await as(B);
  return r[0].id;
})());
await rejects("B cannot insert into A's log", () => q(`insert into log_quarters (log_id,user_id,rub,planned) values ($1,$2,30,true)`, [aLog, B]));
await rejects("B cannot write rows in A's name", () => q(`insert into daily_logs (user_id, log_date, target_quarters) values ($1, $2, 4)`, [A, today]));
const upd = await db.query(`update profiles set daily_target = 1 where id = $1`, [A]);
check("B cannot update A's profile", upd.affectedRows === 0);
const del = await db.query(`delete from daily_logs where user_id = $1`, [A]);
check("B cannot delete A's logs", del.affectedRows === 0);
await rejects("B cannot look up emails by username", () => q(`select email_for_username('ahmad')`));
await rejects("B cannot touch rate limits", () => q(`select hit_rate_limit('x', 1, 60)`));
await rejects("B cannot read the job log", () => q(`select * from job_runs`));

console.log("anon");
await db.exec(`reset role; set role anon; select set_config('test.uid', '', false);`);
await rejects("anon cannot call write functions", () => q(`select set_quality($1, 1::smallint, 'good')`, [today]));

console.log("service role");
await admin();
const hits = [];
for (let i = 0; i < 4; i++) hits.push((await q(`select hit_rate_limit('k', 3, 60) ok`))[0].ok);
check("rate limit allows 3 then blocks", JSON.stringify(hits) === "[true,true,true,false]");
await q(`delete from auth.users where id=$1`, [A]);
check("deleting the auth user removes all their data", (await q(`select count(*)::int c from daily_logs where user_id=$1`, [A]))[0].c === 0);

console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
