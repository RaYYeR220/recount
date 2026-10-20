"use client";

import { useActionState } from "react";
import type { ManageState } from "@/app/dashboard/p/[slug]/actions";
import { Callout, Field, Input, SubmitButton } from "@/components/ui";

/** How many codes to add, and the outcome. */
export function GenerateCodesForm({ action, max }: { action: (prev: ManageState, form: FormData) => Promise<ManageState>; max: number }) {
  const [state, generate] = useActionState(action, {});
  return (
    <form action={generate} className="grid gap-3">
      <div className="flex flex-wrap items-start gap-3">
        <Field id="code-count" label="How many codes?" hint={`Up to ${max} at a time.`} className="w-[12rem]">
          <Input type="number" name="count" min={1} max={max} defaultValue={10} inputMode="numeric" required />
        </Field>
        <SubmitButton variant="ink" pendingLabel="Generating…" className="sm:mt-[26px]">
          Generate codes
        </SubmitButton>
      </div>
      {state.error ? (
        <Callout tone="fail" role="alert">
          {state.error}
        </Callout>
      ) : state.ok ? (
        <Callout tone="match" role="status">
          {state.ok}
        </Callout>
      ) : null}
    </form>
  );
}
