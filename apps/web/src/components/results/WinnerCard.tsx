import { Chit } from "@/components/ui/Chit";
import { findTies } from "@/lib/countTies";
import { listNames } from "@/lib/names";
import { chitOf, roundsWord, type CountView } from "./model";

export type WinnerCardProps = {
  view: Pick<CountView, "winners" | "rounds" | "seats" | "options" | "writeIns">;
  /** The poll is still open: the count so far, not a result. */
  provisional?: boolean;
};

/** The brass plate with the result: "Winner: Tacos", "2 rounds". */
export function WinnerCard({ view, provisional }: WinnerCardProps) {
  const many = view.seats > 1;
  // A seat the tiebreak decided: say so, and while the poll is open, name everyone level.
  const tie = findTies(view.rounds).find((x) => x.kind === "seat" && x.picked.some((w) => view.winners.includes(w)));
  const level = provisional && !many && tie ? tie.tied : null;
  const label = level ? "Tied" : provisional ? "Leading" : many ? "Winners" : "Winner";
  const names = level ?? view.winners;
  const tiebreak = !tie ? "" : provisional ? `, ${listNames(tie.picked)} ahead on the tiebreak` : many ? `, ${listNames(tie.picked)} elected on a tiebreak` : ", won on a tiebreak";
  return (
    <div className="winner-card" data-testid="winner-card">
      <span className="winner-chits" aria-hidden="true">
        {names.map((w) => (
          <Chit key={w} index={chitOf(w, view)} size={28} />
        ))}
      </span>
      <div className="min-w-0">
        <p className="wl">
          {label}: {names.join(", ")}
        </p>
        <p className="ws">
          {roundsWord(view.rounds.length)}
          {provisional ? " so far" : ""}
          {tiebreak}
        </p>
      </div>
    </div>
  );
}
