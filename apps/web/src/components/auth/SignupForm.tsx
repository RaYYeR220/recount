"use client";

import { useActionState } from "react";
import { signUp, type AuthFormState } from "@/app/(auth)/actions";
import { Callout, Field, Input, SubmitButton } from "@/components/ui";
import { NextField } from "./NextField";

/** Email and a password; the account starts signed in. */
export function SignupForm() {
  const [state, action] = useActionState<AuthFormState, FormData>(signUp, {});

  return (
    <form action={action} noValidate className="grid gap-5">
      <NextField />
      {state.error ? (
        <Callout tone="fail" role="alert">
          {state.error}
        </Callout>
      ) : null}
      <Field id="signup-email" label="Email" error={state.fields?.email}>
        <Input name="email" type="email" autoComplete="email" inputMode="email" defaultValue={state.email} required />
      </Field>
      <Field id="signup-password" label="Password" hint="At least 8 characters." error={state.fields?.password}>
        <Input name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <SubmitButton variant="ink" size="lg" pendingLabel="Creating your account…" className="w-full">
        Create account
      </SubmitButton>
    </form>
  );
}
