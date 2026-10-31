// Nightly job (vercel.json on Vercel, deploy/crontab on your own server):
// deletes sample accounts older than a day.
import { NextResponse, type NextRequest } from "next/server";
import { backend } from "@/lib/data";

export const dynamic = "force-dynamic";

const MAX_AGE_HOURS = 24;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await backend.purgeDemo(new Date(Date.now() - MAX_AGE_HOURS * 3600e3));
    return NextResponse.json(result);
  } catch (e) {
    console.error(`purge-demo failed: ${String(e)}`);
    return NextResponse.json({ error: "job failed" }, { status: 500 });
  }
}
