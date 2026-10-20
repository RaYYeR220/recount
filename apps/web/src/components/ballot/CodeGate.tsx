"use client";

import { useActionState } from "react";
import type { CodeState } from "@/app/p/[slug]/actions";
import { Field, Input, SubmitButton } from "@/components/ui";
import { Ballot, type BallotProps } from "./Ballot";
import { BallotHead } from "./BallotHead";
import { VotingSteps } from "./VotingSteps";

export type CodeGateProps = Omit<BallotProps, "code"> & {
  enter: (prev: CodeState, form: FormData) => Promise<CodeState>;
};

/**
 * Invite-code polls ask for the code before the ballot. The code is checked here and
 * used up only when the ballot is cast.
 */
export function CodeGate({ enter, ...ballot }: CodeGateProps) {
  const [state, submit] = useActionState(enter, {});
  if (state.code) return <Ballot {...ballot} code={state.code} />;

  return (
    <div className="mx-auto max-w-[980px]">
      <VotingSteps current={0} />
      <section aria-labelledby="ballot-title" className="paper gilt-frame px-[18px] pb-6 pt-[22px] sm:px-[38px] sm:pb-8 sm:pt-[34px]">
        <BallotHead id="ballot-title" title={ballot.title} description={ballot.description} when={ballot.when} />
        <form action={submit} noValidate className="mt-6 grid max-w-[30rem] gap-4">
          <Field
            id="invite-code"
            label="Invite code"
            hint="The code from your invitation, like QZNU-ZHDS. Capitals and the dash are optional."
            error={state.error}
          >
            <Input mono name="code" defaultValue={state.typed} autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={40} required className="text-lg tracking-[0.06em]" />
          </Field>
          <SubmitButton variant="ink" size="lg" pendingLabel="Checking…" className="justify-self-start">
            Continue to the ballot
          </SubmitButton>
        </form>
        <p className="mt-6 border-t border-paper-3 pt-4 text-sm text-ink-3">Each code casts one ballot. Ballots are final once cast.</p>
      </section>
    </div>
  );
}
