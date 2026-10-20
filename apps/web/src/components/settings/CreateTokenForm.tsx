"use client";

import { useActionState } from "react";
import { createToken, type TokenState } from "@/app/settings/actions";
import { CopyButton } from "@/components/CopyButton";
import { Callout, Field, Input, SubmitButton } from "@/components/ui";

/**
 * Names and creates a token. Its value lives only in this component's state: it is
 * shown once, and a reload forgets it.
 */
export function CreateTokenForm() {
  const [state, create] = useActionState<TokenState, FormData>(createToken, {});
  return (
    <div className="grid gap-4">
      <form action={create} className="flex flex-wrap items-start gap-3">
        <Field id="token-name" label="Token name" hint="What will use it, so you know which one to revoke." error={state.error} className="min-w-0 flex-[1_1_18rem]">
          <Input name="name" maxLength={60} placeholder="Deploy script" autoComplete="off" required />
        </Field>
        <SubmitButton variant="ink" pendingLabel="Creating…" className="sm:mt-[26px]">
          Create token
        </SubmitButton>
      </form>
      {state.token ? (
        <Callout tone="warn" role="status">
          <p>
            <b>Copy the token for “{state.name}” now.</b> It is shown only this once; we keep a hash, not the token.
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
            <code data-testid="new-token" className="mono min-w-0 break-all rounded-slip bg-well px-3 py-2 text-[13.5px] text-ink shadow-[inset_0_0_0_1px_var(--color-paper-4)]">
              {state.token}
            </code>
            <CopyButton text={state.token} done="Token copied." size="sm">
              Copy token
            </CopyButton>
          </div>
        </Callout>
      ) : null}
    </div>
  );
}
