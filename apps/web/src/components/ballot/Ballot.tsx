"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import type { CastState } from "@/app/p/[slug]/actions";
import { Button, Callout, SubmitButton } from "@/components/ui";
import { BallotHead, type BallotWhen } from "./BallotHead";
import { Ranker, type BallotOption } from "./Ranker";
import { RankedList } from "./RankedList";
import { VotingSteps } from "./VotingSteps";

export type BallotProps = {
  title: string;
  description: string;
  options: BallotOption[];
  maxRanks: number | null;
  seats: number;
  when: BallotWhen;
  /** The invite code that opened the ballot, in codes mode. */
  code?: string;
  cast: (prev: CastState, form: FormData) => Promise<CastState>;
};

const SLIP = "paper gilt-frame px-[18px] pb-5 pt-[22px] sm:px-[38px] sm:pb-8 sm:pt-[34px]";

/**
 * The ballot: rank, review, cast. Casting posts the ranking from a form whose button
 * disables itself while sending, and a second submit is dropped here as well, so a
 * double click sends one ballot (the server would refuse a second one anyway).
 */
export function Ballot({ title, description, options, maxRanks, seats, when, code, cast }: BallotProps) {
  const [ranking, setRanking] = useState<string[]>([]);
  const [step, setStep] = useState<"rank" | "review">("rank");
  const [state, castAction] = useActionState(cast, {});
  const sent = useRef(false);

  // An answer from the server (only errors come back; success navigates) allows a retry.
  useEffect(() => {
    sent.current = false;
  }, [state]);

  function show(next: "rank" | "review") {
    setStep(next);
    requestAnimationFrame(() => {
      document.getElementById(next === "rank" ? "ballot-title" : "review-title")?.focus();
      document.getElementById("ballot")?.scrollIntoView({ block: "start" });
    });
  }

  function guard(event: FormEvent<HTMLFormElement>) {
    if (sent.current) event.preventDefault();
    else sent.current = true;
  }

  const byId = new Map(options.map((o, i) => [o.id, { ...o, index: i }]));
  const left = options.length - ranking.length;
  const method = seats === 1 ? "One winner, counted by instant runoff." : `${seats} seats, filled by single transferable vote.`;

  return (
    <div id="ballot" className="mx-auto max-w-[980px] scroll-mt-24">
      <VotingSteps current={step === "rank" ? 0 : 1} />
      {step === "rank" ? (
        <section aria-labelledby="ballot-title" className={SLIP}>
          <BallotHead id="ballot-title" title={title} description={description} when={when} />
          <p className="mb-[22px] mt-[18px] text-sm text-ink-2 [&_b]:text-ink">
            Press <b>Rank</b> on the options in the order you prefer them. Change the order with <b>Move up</b> and <b>Move down</b>; take one off with{" "}
            <b>Remove</b>. {method}
          </p>
          <Ranker options={options} ranking={ranking} onChange={setRanking} maxRanks={maxRanks} />
          <div className="mt-[26px] flex flex-wrap items-center justify-end gap-4 border-t border-paper-3 pt-5">
            <Button variant="brass" size="lg" disabled={ranking.length === 0} onClick={() => show("review")}>
              Review ballot
            </Button>
          </div>
        </section>
      ) : (
        <section aria-labelledby="review-title" className={SLIP}>
          <BallotHead id="review-title" title="Review your ballot" description="This is the order your ballot will be counted in. Nothing is cast until you press Cast ballot." />
          <RankedList ranking={ranking.map((id) => byId.get(id)!)} className="mt-[18px]" />
          {left > 0 ? (
            <p className="mt-3.5 text-sm text-ink-2">
              You left {left} {left === 1 ? "option" : "options"} unranked. That is allowed; unranked options get none of your vote.
            </p>
          ) : null}
          {state.error ? (
            <Callout tone="fail" role="alert" className="mt-4">
              {state.error}
            </Callout>
          ) : null}
          <div className="mt-[26px] flex flex-wrap items-center justify-between gap-4 border-t border-paper-3 pt-5">
            <Button variant="line" onClick={() => show("rank")}>
              Change ranking
            </Button>
            <form action={castAction} onSubmit={guard}>
              {ranking.map((id) => (
                <input key={id} type="hidden" name="ranking" value={id} />
              ))}
              {code ? <input type="hidden" name="code" value={code} /> : null}
              <SubmitButton variant="ink" size="lg" pendingLabel="Casting…" disabled={state.alreadyVoted}>
                Cast ballot
              </SubmitButton>
            </form>
          </div>
        </section>
      )}
      <noscript>
        <p className="mt-4 text-center text-sm text-cream-2">Ranking needs JavaScript. Turn it on to vote.</p>
      </noscript>
    </div>
  );
}
