import type { ReactNode } from "react";
import { CountTable } from "@/components/table/CountTable";
import type { CountScene } from "@/lib/countScene";
import { CondorcetCheck } from "./CondorcetCheck";
import { InactiveBreakdown } from "./InactiveBreakdown";
import type { CountView } from "./model";
import { RoundTable } from "./RoundTable";
import { TransferList } from "./TransferList";
import { WhyItWon } from "./WhyItWon";

export type ResultsLayoutProps = {
  view: CountView;
  scene: CountScene;
  /** Accessible name of the count table. */
  title: string;
  /** Where tiebreak draws come from, for the tie notes: "seeded from the cast-vote record's SHA-256". */
  seedSource?: string;
  /** The poll is still open: tell the count so far in the present tense. */
  provisional?: boolean;
  /** Extra panels: after the round table, at the head and at the foot of the side column. */
  main?: ReactNode;
  sideFirst?: ReactNode;
  side?: ReactNode;
  roundNote?: ReactNode;
  inactiveNote?: ReactNode;
};

/** The count table, the round-by-round panels and the side column of checks. */
export function ResultsLayout({ view, scene, title, seedSource, provisional, main, sideFirst, side, roundNote, inactiveNote }: ResultsLayoutProps) {
  return (
    <div className="res-grid">
      <div className="res-main">
        <CountTable scene={scene} title={title} />
        <RoundTable view={view} note={roundNote} provisional={provisional} />
        {main}
        <TransferList view={view} />
        <InactiveBreakdown view={view} note={inactiveNote} />
      </div>
      <div className="res-side">
        {sideFirst}
        <WhyItWon view={view} seedSource={seedSource} provisional={provisional} />
        <CondorcetCheck view={view} provisional={provisional} />
        {side}
      </div>
    </div>
  );
}
