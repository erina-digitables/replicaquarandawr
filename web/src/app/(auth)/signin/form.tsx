"use client";

import { KeyRound, LogIn, User } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { signIn } from "@/app/actions/auth";
import { TextField } from "@/components/ui/text-field";
import { AuthTabs, DemoForm, FormError, SubmitButton } from "../shared";

const notices: Record<string, string> = {
  failed: "That confirmation link didn't work. It may have expired. Sign in, or create the account again for a new link.",
  busy: "The sample account is busy right now. Try again in a little while.",
};

export function SignInForm({ notice }: { notice?: string }) {
  const [state, action] = useActionState(signIn, null);
  return (
    <>
      <AuthTabs active="signin" />
      <h1 className="sr-only">Sign in</h1>
      <form action={action} className="flex flex-col gap-4" noValidate>
        {notice && notices[notice] && !state?.error && (
          <p role="status" className="rounded-md border border-highlight/30 bg-highlight-soft px-3 py-2 text-sm text-text">
            {notices[notice]}
          </p>
        )}
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
