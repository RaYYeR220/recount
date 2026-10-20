"use client";

import { useActionState } from "react";
import type { VerifyState } from "@/app/p/[slug]/actions";
import { Callout, Field, Input, SubmitButton } from "@/components/ui";
import { formatWhen } from "@/lib/when";
import { RankedList } from "./RankedList";

export type VerifyFormProps = {
  check: (prev: VerifyState, form: FormData) => Promise<VerifyState>;
  /** Option labels in ballot order, for the chits. */
  labels: string[];
  timeZone: string;
};

/** Receipt in, the ballot as recorded out. */
export function VerifyForm({ check, labels, timeZone }: VerifyFormProps) {
  const [state, submit] = useActionState(check, {});
  const index = new Map(labels.map((label, i) => [label, i]));
  return (
    <div className="grid gap-6">
      <form action={submit} noValidate className="flex flex-wrap items-start gap-3">
        <Field id="receipt" label="Receipt" hint="12 letters and digits; dashes and capitals are optional." error={state.error} className="min-w-0 flex-[1_1_18rem]">
          <Input mono name="receipt" defaultValue={state.receipt} placeholder="xxxx-xxxx-xxxx" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={40} className="text-lg tracking-[0.04em]" />
        </Field>
        <SubmitButton variant="ink" pendingLabel="Checking…" className="sm:mt-[26px]">
          Check
        </SubmitButton>
      </form>
      {state.ranking ? (
        <section aria-labelledby="recorded-title" className="grid gap-3" role="status">
          <h2 id="recorded-title" className="title text-xl text-ink">
            Your ballot as recorded
          </h2>
          <RankedList ranking={state.ranking.map((label) => ({ label, index: index.get(label) ?? 0 }))} />
          {state.castAt ? (
            <Callout tone="match">
              Cast {formatWhen(state.castAt, timeZone)} ({timeZone}). This is the ranking the count reads.
            </Callout>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
