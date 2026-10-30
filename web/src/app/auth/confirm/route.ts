// Landing page for the "confirm your email" link. The email template links to
// /auth/confirm?token_hash=...&type=email (supabase/templates/confirmation.html).
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { userClient } from "@/lib/supabase/clients";

const ALLOWED: EmailOtpType[] = ["email", "signup"];

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const dest = request.nextUrl.clone();
  dest.search = "";

  if (tokenHash && type && ALLOWED.includes(type)) {
    const sb = await userClient();
    const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      dest.pathname = "/today";
      return NextResponse.redirect(dest);
    }
  }
  dest.pathname = "/signin";
  dest.searchParams.set("confirm", "failed");
  return NextResponse.redirect(dest);
}
