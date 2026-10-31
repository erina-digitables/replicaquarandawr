// Landing page for the "confirm your email" link. The email template links to
// /auth/confirm?token_hash=...&type=email (supabase/templates/confirmation.html).
import { NextResponse, type NextRequest } from "next/server";
import { backend } from "@/lib/data";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const dest = request.nextUrl.clone();
  dest.search = "";

  if (tokenHash && type && (await backend.confirmEmail(tokenHash, type))) {
    dest.pathname = "/today";
    return NextResponse.redirect(dest);
  }
  dest.pathname = "/signin";
  dest.searchParams.set("confirm", "failed");
  return NextResponse.redirect(dest);
}
