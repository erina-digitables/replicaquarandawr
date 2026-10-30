// Seeds two made-up sample accounts with a few weeks of revision, for local and
// staging projects only. Refuses to run without an explicit project and password.
//   node --env-file=.env.local scripts/seed.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.SEED_PASSWORD;
if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example).");
if (!password || password.length < 12) throw new Error("Set SEED_PASSWORD (12+ characters) for the sample accounts.");

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

// Invented people on a reserved test domain.
const people = [
  { fullName: "Sample Reader One", username: "sample_one", email: "sample.one@example.test", timezone: "Europe/London", days: 21, perDay: 4 },
  { fullName: "Sample Reader Two", username: "sample_two", email: "sample.two@example.test", timezone: "Asia/Karachi", days: 10, perDay: 8 },
];
const qualities = ["good", "good", "good", "average", "needs_work"];

function isoDaysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

for (const p of people) {
  const existing = await admin.from("profiles").select("id").eq("username", p.username).maybeSingle();
  if (existing.data) {
    console.log(`skip ${p.username} (exists)`);
    continue;
  }
  const created = await admin.auth.admin.createUser({
    email: p.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: p.fullName, username: p.username, timezone: p.timezone },
  });
  if (created.error) throw created.error;
  const userId = created.data.user.id;

  let rub = 1;
  for (let i = p.days; i >= 1; i--) {
    if (i % 6 === 0) continue; // a missed day now and then
    const count = i % 5 === 0 ? p.perDay - 1 : p.perDay;
    const log = await admin
      .from("daily_logs")
      .insert({ user_id: userId, log_date: isoDaysAgo(i), target_quarters: p.perDay })
      .select("id")
      .single();
    if (log.error) throw log.error;
    const rows = Array.from({ length: count }, (_, k) => {
      const row = {
        log_id: log.data.id,
        user_id: userId,
        rub,
        quality: qualities[(rub + k) % qualities.length],
        completed_at: `${isoDaysAgo(i)}T05:30:00Z`,
      };
      rub = (rub % 240) + 1;
      return row;
    });
    const ins = await admin.from("log_quarters").insert(rows);
    if (ins.error) throw ins.error;
  }
  console.log(`seeded ${p.username}`);
}
