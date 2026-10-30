import type { Metadata } from "next";
import { hasPendingReset } from "@/app/actions/auth";
import { backend } from "@/lib/data";
import { CodeForm } from "./form";

export const metadata: Metadata = { title: "Enter your code" };

export default async function Page() {
  // Who the code is for is kept in an http-only cookie, never in the URL.
  return <CodeForm knowsWho={await hasPendingReset()} devBackend={backend.name === "fake"} />;
}
