import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { Settings } from "./settings";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser();
  const tab = (await searchParams).tab;
  return <Settings profile={user} initialTab={tab === "account" || tab === "tips" ? tab : "goal"} />;
}
