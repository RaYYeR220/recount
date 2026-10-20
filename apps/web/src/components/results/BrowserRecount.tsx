"use client";

import { comparePollRecount, pollMatchLine, type PollRecountRequest, type PublishedPoll } from "@/lib/recount";
import { formatCount } from "@/lib/votes";
import { RecountShell, type RecountVerdict } from "./RecountShell";
import { useRecountWorker } from "./useRecountWorker";

export type BrowserRecountProps = {
  request: PollRecountRequest;
  /** What the page shows: the hash, the winners and every round. */
  published: PublishedPoll;
  seats: number;
};

/**
 * Downloads the cast-vote record, hashes the exact bytes and counts them again in a
 * worker with the poll's rules, then holds the outcome against the published result.
 */
export function BrowserRecount({ request, published, seats }: BrowserRecountProps) {
  const { state, run } = useRecountWorker();
  let verdict: RecountVerdict | null = null;
  if (state.status === "done" && state.result.kind === "poll") {
    const result = state.result;
    const differences = comparePollRecount(published, result);
    const seconds = (state.ms / 1000).toFixed(1);
    verdict =
      differences.length === 0
        ? {
            matches: true,
            line: pollMatchLine(seats, result),
            detail: `${formatCount(result.rows)} ${result.rows === 1 ? "ballot" : "ballots"} hashed and counted in this browser in ${seconds} s.`,
            differences,
          }
        : { matches: false, line: "Recount does not match the published result.", differences };
  }
  return (
    <RecountShell
      state={state}
      onRun={() => run(request)}
      verdict={verdict}
      intro="Downloads the cast-vote record, hashes it and counts it again here, with the same rules and tiebreak seed."
    />
  );
}
