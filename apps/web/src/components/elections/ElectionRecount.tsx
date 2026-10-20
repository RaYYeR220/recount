"use client";

import { RecountShell, type RecountVerdict } from "@/components/results/RecountShell";
import { useRecountWorker } from "@/components/results/useRecountWorker";
import { compareElectionRecount, figuresLine, largestGap, type ElectionRecountRequest, type PublishedElection } from "@/lib/recount";
import { formatCount } from "@/lib/votes";

export type ElectionRecountProps = {
  request: ElectionRecountRequest;
  published: PublishedElection;
  seats: number;
};

/**
 * Downloads the ballot file, unpacks it with the browser's own gzip, counts it in a
 * worker and holds every figure against the official report again.
 */
export function ElectionRecount({ request, published, seats }: ElectionRecountProps) {
  const { state, run } = useRecountWorker();
  let verdict: RecountVerdict | null = null;
  if (state.status === "done" && state.result.kind === "election") {
    const r = state.result;
    const differences = compareElectionRecount(published, r);
    const figures = r.cells === null ? "no official figures to compare" : figuresLine(r.cells, r.mismatches.length, published.against);
    const gap = largestGap(r.mismatches);
    const within = r.mismatches.length > 0 ? `, within ${gap} ${gap === 1 ? "vote" : "votes"}` : "";
    const seconds = (state.ms / 1000).toFixed(1);
    verdict =
      differences.length === 0
        ? {
            matches: true,
            line: `Recount in your browser: ${figures}${within}.`,
            detail: `Same ${seats > 1 ? "winners" : "winner"}, same ${r.rounds} rounds, ballot file SHA-256 ${r.sha256.slice(0, 12)}. ${formatCount(r.totalBallots)} ballots counted here in ${seconds} s.`,
            differences,
          }
        : { matches: false, line: "The browser's recount does not match this page.", differences };
  }
  return (
    <RecountShell
      state={state}
      onRun={() => run(request)}
      verdict={verdict}
      intro="Downloads the ballot file, checks its SHA-256, unpacks it and counts every round again here, then compares each figure with the official report."
    />
  );
}
