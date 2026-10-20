"use client";

import { useActionState, type MouseEvent } from "react";
import { logIn, type AuthFormState } from "@/app/(auth)/actions";
import { Button, Callout, Field, Input, SubmitButton } from "@/components/ui";
import { NextField } from "./NextField";

const DEMO = { email: "ada@recount.dev", password: "recount-demo-ada" };

function fillDemo(event: MouseEvent<HTMLButtonElement>) {
  const form = event.currentTarget.form;
  const email = form?.elements.namedItem("email");
  const password = form?.elements.namedItem("password");
  if (email instanceof HTMLInputElement) email.value = DEMO.email;
  if (password instanceof HTMLInputElement) {
    password.value = DEMO.password;
    password.focus();
  }
}

/** Email and password. Wrong credentials say so without telling which one was wrong. */
export function LoginForm() {
  const [state, action] = useActionState<AuthFormState, FormData>(logIn, {});

  return (
    <form action={action} noValidate className="grid gap-5">
      <NextField />
      {state.error ? (
        <Callout tone="fail" role="alert">
          {state.error}
        </Callout>
      ) : null}
      <Field id="login-email" label="Email" error={state.fields?.email}>
        <Input name="email" type="email" autoComplete="email" inputMode="email" defaultValue={state.email} required />
      </Field>
      <Field id="login-password" label="Password" error={state.fields?.password}>
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton variant="ink" size="lg" pendingLabel="Signing in…" className="w-full">
        Sign in
      </SubmitButton>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-paper-3 pt-4 text-sm text-ink-3">
        <span>Looking around? Use the demo organizer.</span>
        <Button variant="quiet" size="sm" className="px-0" onClick={fillDemo}>
          Fill in the demo account
        </Button>
      </div>
    </form>
  );
}
