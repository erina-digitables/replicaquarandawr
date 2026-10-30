"use client";

import { CheckCircle2, KeyRound, LogIn, MailCheck, User } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { resetWithCode } from "@/app/actions/auth";
import { TextField } from "@/components/ui/text-field";
import { FormError, SubmitButton } from "../../shared";

export function CodeForm({ knowsWho, devBackend }: { knowsWho: boolean; devBackend: boolean }) {
  const [state, action] = useActionState(resetWithCode, null);

  if (state?.notice) {
    return (
      <div role="status" className="flex flex-col items-center gap-4 text-center">
        <CheckCircle2 aria-hidden className="size-10 text-success" />
        <h1 className="font-display text-lg text-text">{state.notice}</h1>
        <Link href="/signin" className="inline-flex h-11 items-center gap-2 rounded-md bg-accent px-4 text-sm font-bold text-on-accent hover:bg-accent-hover">
          <LogIn aria-hidden className="size-4" /> Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="font-display text-lg text-text">Enter your code</h1>
      {knowsWho ? (
        <p className="mb-6 mt-1 flex items-start gap-2 text-sm text-text-muted">
          <MailCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
          If an account matches, a code is on its way. It works for 15 minutes.
        </p>
      ) : (
        <p className="mb-6 mt-1 text-sm text-text-muted">Use the 6-digit code from the email we sent you.</p>
      )}
      {devBackend && (
        <p className="mb-4 rounded-md border border-highlight/30 bg-highlight-soft px-3 py-2 text-xs text-text">
          Development backend: no email is sent, so the code is printed in the server log.
        </p>
      )}
      <form action={action} className="flex flex-col gap-4" noValidate>
        <FormError message={state?.error} />
        {!knowsWho && (
          <TextField
            label="Username or email"
            name="identifier"
            icon={<User />}
            autoComplete="username"
            autoCapitalize="none"
            required
            defaultValue={state?.values?.identifier}
            error={state?.fields?.identifier}
          />
        )}
        <TextField
          label="Code"
          name="code"
          variant="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          // Room for a pasted "123 456"; the server strips spaces (BUG-003).
          maxLength={9}
          placeholder="000000"
          required
          defaultValue={state?.values?.code}
          error={state?.fields?.code}
        />
        <TextField
          label="New password"
          name="password"
          icon={<KeyRound />}
          variant="password"
          autoComplete="new-password"
          required
          error={state?.fields?.password}
          hint="At least 8 characters."
        />
        <SubmitButton>Set new password</SubmitButton>
      </form>
      <p className="mt-6 border-t border-border pt-6 text-center text-sm">
        <Link href="/forgot" className="font-bold text-accent underline-offset-2 hover:underline">
          Send a new code
        </Link>
      </p>
    </>
  );
}
