"use client";

import { AtSign, KeyRound, Mail, MailCheck, UserPlus } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { signUp } from "@/app/actions/auth";
import { TextField } from "@/components/ui/text-field";
import { AuthTabs, DemoForm, FormError, SubmitButton, TimezoneInput } from "../shared";

export function SignUpForm() {
  const [state, action] = useActionState(signUp, null);
  const f = state?.fields ?? {};
  const v = state?.values ?? {};
  if (state?.notice) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 text-center">
        <MailCheck aria-hidden className="size-10 text-success" />
        <h1 className="font-display text-lg text-text">Check your email</h1>
        <p className="text-sm text-text-muted">{state.notice}</p>
        <Link href="/signin" className="mt-2 text-sm font-bold text-accent underline-offset-2 hover:underline">
          Go to sign in
        </Link>
      </div>
    );
  }
  return (
    <>
      <AuthTabs active="signup" />
      <h1 className="sr-only">Create an account</h1>
      <form action={action} className="flex flex-col gap-4" noValidate>
        <FormError message={state?.error} />
        <TimezoneInput />
        <TextField label="Your name" name="fullName" autoComplete="name" required maxLength={80} defaultValue={v.fullName} error={f.fullName} />
        <TextField
          label="Username"
          name="username"
          icon={<AtSign />}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={v.username}
          error={f.username}
          hint="Lowercase letters, numbers and _. You can sign in with it."
        />
        <TextField label="Email" name="email" type="email" icon={<Mail />} autoComplete="email" required defaultValue={v.email} error={f.email} />
        <TextField
          label="Password"
          name="password"
          icon={<KeyRound />}
          variant="password"
          autoComplete="new-password"
          required
          error={f.password}
          hint="At least 8 characters."
        />
        <SubmitButton icon={<UserPlus aria-hidden className="size-4" />}>Create account</SubmitButton>
      </form>
      <DemoForm />
    </>
  );
}
