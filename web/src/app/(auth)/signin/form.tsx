"use client";

import { KeyRound, LogIn, User } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { signIn } from "@/app/actions/auth";
import { TextField } from "@/components/ui/text-field";
import { AuthTabs, DemoForm, FormError, SubmitButton } from "../shared";

export function SignInForm() {
  const [state, action] = useActionState(signIn, null);
  return (
    <>
      <AuthTabs active="signin" />
      <h1 className="sr-only">Sign in</h1>
      <form action={action} className="flex flex-col gap-4" noValidate>
        <FormError message={state?.error} />
        <TextField
          label="Username or email"
          name="identifier"
          icon={<User />}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={state?.values?.identifier}
        />
        <div className="flex flex-col gap-1">
          <TextField label="Password" name="password" icon={<KeyRound />} variant="password" autoComplete="current-password" required />
          <Link href="/forgot" className="self-end rounded-sm py-1 text-sm font-bold text-accent underline-offset-2 hover:underline">
            Forgot your password?
          </Link>
        </div>
        <SubmitButton icon={<LogIn aria-hidden className="size-4" />}>Sign in</SubmitButton>
      </form>
      <DemoForm />
    </>
  );
}
