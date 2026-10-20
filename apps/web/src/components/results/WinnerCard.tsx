import { Chit } from "@/components/ui/Chit";
import { chitOf, roundsWord, type CountView } from "./model";

export type WinnerCardProps = {
  view: Pick<CountView, "winners" | "rounds" | "seats" | "options" | "writeIns">;
  /** The poll is still open: the count so far, not a result. */
  provisional?: boolean;
};

/** The brass plate with the result: "Winner: Tacos", "2 rounds". */
export function WinnerCard({ view, provisional }: WinnerCardProps) {
  const many = view.seats > 1;
  const label = provisional ? "Leading" : many ? "Winners" : "Winner";
  return (
    <div className="winner-card" data-testid="winner-card">
      <span className="winner-chits" aria-hidden="true">
        {view.winners.map((w) => (
          <Chit key={w} index={chitOf(w, view)} size={28} />
        ))}
      </span>
      <div className="min-w-0">
        <p className="wl">
          {label}: {view.winners.join(", ")}
        </p>
        <p className="ws">
          {roundsWord(view.rounds.length)}
          {provisional ? " so far" : ""}
        </p>
      </div>
    </div>
  );
}
