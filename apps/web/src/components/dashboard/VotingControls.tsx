"use client";

import { useActionState, useState, useTransition } from "react";
import type { ManageState } from "@/app/dashboard/p/[slug]/actions";
import { Button, Callout, Field, Input, SubmitButton } from "@/components/ui";
import { WALL_INPUT_FORMAT } from "@/lib/when";

export type VotingControlsProps = {
  closeNow: () => Promise<ManageState>;
  changeClosingTime: (prev: ManageState, form: FormData) => Promise<ManageState>;
  /** The current closing time as typed, "2027-01-22 12:00", or "" for none. */
  closesText: string;
  timeZone: string;
};

function Outcome({ state }: { state: ManageState }) {
  if (state.error) {
    return (
      <Callout tone="fail" role="alert">
        {state.error}
      </Callout>
    );
  }
  if (!state.ok) return null;
  return (
    <div className="grid gap-2" role="status">
      <Callout tone="match">{state.ok}</Callout>
      {state.warnings?.map((w) => (
        <Callout key={w} tone="warn">
          {w}
        </Callout>
      ))}
    </div>
  );
}

/** Close now (asks first: a closed poll can't reopen) and move the closing time. */
export function VotingControls({ closeNow, changeClosingTime, closesText, timeZone }: VotingControlsProps) {
  const [confirming, setConfirming] = useState(false);
  const [closeState, setCloseState] = useState<ManageState>({});
  const [closing, startClosing] = useTransition();
  const [extendState, extend] = useActionState(changeClosingTime, {});

  return (
    <div className="grid gap-6">
      <form action={extend} className="grid gap-3">
        <div className="flex flex-wrap items-start gap-3">
          <Field id="closes-at" label="Closing time" hint={`Format ${WALL_INPUT_FORMAT}, 24-hour, in ${timeZone}. Leave empty to close by hand.`} className="min-w-0 flex-[1_1_16rem]">
            <Input mono name="closes" defaultValue={closesText} placeholder={WALL_INPUT_FORMAT} inputMode="numeric" autoComplete="off" spellCheck={false} />
          </Field>
          <SubmitButton variant="line" pendingLabel="Saving…" className="sm:mt-[26px]">
            Save closing time
          </SubmitButton>
        </div>
        <Outcome state={extendState} />
      </form>

      <div className="grid gap-3 border-t border-paper-3 pt-5">
        {confirming ? (
          <div className="grid gap-3 rounded-field bg-paper-2 p-4">
            <p className="text-sm text-ink-2">
              <b className="text-ink">Close voting now?</b> Ballots stop the moment you confirm, the count is saved with the poll, and it can&apos;t reopen.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <Button
                variant="danger"
                disabled={closing}
                aria-busy={closing || undefined}
                onClick={() =>
                  startClosing(async () => {
                    const result = await closeNow();
                    setCloseState(result);
                    setConfirming(false);
                  })
                }
              >
                {closing ? "Closing…" : "Yes, close voting"}
              </Button>
              <Button variant="line" onClick={() => setConfirming(false)} disabled={closing}>
                Keep it open
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-3">Stop voting early and publish the final count.</p>
            <Button variant="line" onClick={() => setConfirming(true)}>
              Close voting now
            </Button>
          </div>
        )}
        <Outcome state={closeState} />
      </div>
    </div>
  );
}
