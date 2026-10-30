"use client";

import { ArrowLeft, Send, User } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { requestReset } from "@/app/actions/auth";
import { TextField } from "@/components/ui/text-field";
import { FormError, SubmitButton } from "../shared";

export function ForgotForm() {
  const [state, action] = useActionState(requestReset, null);
  return (
    <>
      <h1 className="font-display text-lg text-text">Reset your password</h1>
      <p className="mb-6 mt-1 text-sm text-text-muted">Enter your username or email. We&apos;ll send a 6-digit code to the email on the account.</p>
      <form action={action} className="flex flex-col gap-4" noValidate>
        <FormError message={state?.error} />
        <TextField
          label="Username or email"
          name="identifier"
          icon={<User />}
          autoComplete="username"
          autoCapitalize="none"
          required
          defaultValue={state?.values?.identifier}
        />
        <SubmitButton icon={<Send aria-hidden className="size-4" />}>Send me a code</SubmitButton>
      </form>
      <div className="mt-6 flex flex-col items-center gap-2 border-t border-border pt-6 text-sm">
        <Link href="/forgot/code" className="font-bold text-accent underline-offset-2 hover:underline">
          I already have a code
        </Link>
        <Link href="/signin" className="inline-flex items-center gap-1 text-text-muted hover:text-text">
          <ArrowLeft aria-hidden className="size-4" /> Back to sign in
        </Link>
      </div>
    </>
  );
}
