// Nightly job (vercel.json): deletes sample accounts older than a day.
// Every run is recorded in job_runs; a failed run stays there with its error.
import { NextResponse, type NextRequest } from "next/server";
import { adminClient } from "@/lib/supabase/clients";
import { supabaseConfigured } from "@/lib/data/supabase";

export const dynamic = "force-dynamic";

const MAX_AGE_HOURS = 24;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ skipped: "no database configured" });

  const admin = adminClient();
  const run = await admin.from("job_runs").insert({ job: "purge-demo" }).select("id").single<{ id: string }>();
  const runId = run.data?.id;
  let deleted = 0;
  const failed: string[] = [];
  try {
    const cutoff = new Date(Date.now() - MAX_AGE_HOURS * 3600e3).toISOString();
    const { data, error } = await admin.from("profiles").select("id").eq("is_demo", true).lt("created_at", cutoff).limit(500);
    if (error) throw error;
    for (const { id } of data ?? []) {
      // Retry each delete once before giving up on it.
      let res = await admin.auth.admin.deleteUser(id);
      if (res.error) res = await admin.auth.admin.deleteUser(id);
      if (res.error) failed.push(id);
      else deleted++;
    }
    await admin
      .from("job_runs")
      .update({ finished_at: new Date().toISOString(), ok: failed.length === 0, detail: { deleted, failed } })
      .eq("id", runId);
    return NextResponse.json({ deleted, failed: failed.length });
  } catch (e) {
    await admin
      .from("job_runs")
      .update({ finished_at: new Date().toISOString(), ok: false, detail: { deleted, error: String(e) } })
      .eq("id", runId);
    return NextResponse.json({ error: "job failed" }, { status: 500 });
  }
}
