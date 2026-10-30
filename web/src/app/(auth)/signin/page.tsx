import type { Metadata } from "next";
import { SignInForm } from "./form";

export const metadata: Metadata = { title: "Sign in" };

export default async function Page({ searchParams }: { searchParams: Promise<{ confirm?: string; demo?: string }> }) {
  const sp = await searchParams;
  return <SignInForm notice={sp.confirm ?? sp.demo} />;
}
