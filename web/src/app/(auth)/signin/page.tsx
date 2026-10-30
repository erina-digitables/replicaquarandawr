import type { Metadata } from "next";
import { SignInForm } from "./form";

export const metadata: Metadata = { title: "Sign in" };

export default function Page() {
  return <SignInForm />;
}
