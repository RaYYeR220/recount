"use client";

import { useActionState, useState, type ReactNode } from "react";
import { signUp, type AuthFormState } from "@/app/(auth)/actions";
import { Callout, Field, Input, SubmitButton } from "@/components/ui";

/**
 * Email and a password; the account starts signed in. The password is held here,
 * never sent back by the server, so a refused attempt keeps it for the next try.
 */
export function SignupForm({ children }: { children: ReactNode }) {
  const [state, action] = useActionState<AuthFormState, FormData>(signUp, {});
  const [password, setPassword] = useState("");

  return (
    <form action={action} noValidate className="grid gap-5">
      {children}
      {state.error ? (
        <Callout tone="fail" role="alert">
          {state.error}
        </Callout>
      ) : null}
      <Field id="signup-email" label="Email" error={state.fields?.email}>
        <Input name="email" type="email" autoComplete="email" inputMode="email" defaultValue={state.email} required />
      </Field>
      <Field id="signup-password" label="Password" hint={state.fields?.password ? undefined : "At least 8 characters."} error={state.fields?.password}>
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
      </Field>
      <SubmitButton variant="ink" size="lg" pendingLabel="Creating your account…" className="w-full">
        Create account
      </SubmitButton>
    </form>
  );
}
