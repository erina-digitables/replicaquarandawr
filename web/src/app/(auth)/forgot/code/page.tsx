import type { Metadata } from "next";
import { CodeForm } from "./form";

export const metadata: Metadata = { title: "Enter your code" };

export default async function Page({ searchParams }: { searchParams: Promise<{ for?: string }> }) {
  const identifier = (await searchParams).for ?? "";
  return <CodeForm identifier={identifier} />;
}
