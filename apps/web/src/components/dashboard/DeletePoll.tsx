"use client";

import { useActionState, useState } from "react";
import type { ManageState } from "@/app/dashboard/p/[slug]/actions";
import { Callout, Code, Field, Input, SubmitButton } from "@/components/ui";

/** Deleting takes the slug typed out, so it never happens by a stray click. */
export function DeletePoll({ slug, action }: { slug: string; action: (prev: ManageState, form: FormData) => Promise<ManageState> }) {
  const [state, remove] = useActionState(action, {});
  const [typed, setTyped] = useState("");
  return (
    <form action={remove} className="grid gap-3">
      <p className="text-sm text-ink-2">
        The poll, its options, ballots and invite codes are removed for good. The audit log is kept. This can&apos;t be undone.
      </p>
      <Field id="delete-confirm" label={<>Type <Code>{slug}</Code> to confirm</>}>
        <Input mono name="confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} />
      </Field>
      {state.error ? (
        <Callout tone="fail" role="alert">
          {state.error}
        </Callout>
      ) : null}
      <SubmitButton variant="danger" disabled={typed.trim() !== slug} pendingLabel="Deleting…" className="justify-self-start">
        Delete poll
      </SubmitButton>
    </form>
  );
}
