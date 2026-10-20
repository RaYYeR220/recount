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
  /** Where tiebreak draws are seeded from, for the tie notes. */
  seedSource?: string;
  /** Extra panels: after the round table, at the head and at the foot of the side column. */
  main?: ReactNode;
  sideFirst?: ReactNode;
  side?: ReactNode;
  roundNote?: ReactNode;
  inactiveNote?: ReactNode;
};

/** The count table, the round-by-round panels and the side column of checks. */
export function ResultsLayout({ view, scene, title, seedSource, main, sideFirst, side, roundNote, inactiveNote }: ResultsLayoutProps) {
  return (
    <div className="res-grid">
      <div className="res-main">
        <CountTable scene={scene} title={title} />
        <RoundTable view={view} note={roundNote} />
        {main}
        <TransferList view={view} />
        <InactiveBreakdown view={view} note={inactiveNote} />
      </div>
      <div className="res-side">
        {sideFirst}
        <WhyItWon view={view} seedSource={seedSource} />
        <CondorcetCheck view={view} />
        {side}
      </div>
    </div>
  );
}
