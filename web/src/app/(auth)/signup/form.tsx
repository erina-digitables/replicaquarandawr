"use client";

import { AtSign, KeyRound, Mail, UserPlus } from "lucide-react";
import { useActionState } from "react";
import { signUp } from "@/app/actions/auth";
import { TextField } from "@/components/ui/text-field";
import { AuthTabs, DemoForm, FormError, SubmitButton, TimezoneInput } from "../shared";

export function SignUpForm() {
  const [state, action] = useActionState(signUp, null);
  const f = state?.fields ?? {};
  const v = state?.values ?? {};
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
