import type { CountView } from "@/components/results/model";
import { PanelHeader, Paper } from "@/components/ui/Surface";
import { surname } from "@/lib/names";
import { formatCount, formatVotes, placesOf, toUnits } from "@/lib/votes";

const ORDINAL = ["first", "second", "third", "fourth", "fifth", "sixth"];

/**
 * For a one-seat contest where the head-to-head winner is not the ranked-choice
 * winner: who each method picks, and how the count passed the Condorcet winner by.
 * Renders nothing when they agree.
 */
export function PathologyExplainer({ view, id = "pathology-h" }: { view: CountView; id?: string }) {
  const cw = view.pairwise.condorcetWinner;
  const winner = view.winners[0];
  if (view.seats !== 1 || !cw || !winner || cw === winner) return null;

  const { matrix } = view.pairwise;
  const first = view.rounds[0]!.tally;
  const units = (v: string | undefined) => (v === undefined ? 0n : toUnits(v, placesOf(v)));
  const rivals = view.options
    .filter((o) => o !== cw && matrix[cw]?.[o] !== undefined && !(view.writeIns ?? []).includes(o))
    .sort((a, b) => (units(first[b]) > units(first[a]) ? 1 : -1))
    .slice(0, 3);
  const place = Object.values(first).filter((v) => units(v) > units(first[cw])).length;
  const outAt = view.rounds.findIndex((r) => r.eliminated.includes(cw));
  const last = view.rounds.at(-1)!;
  const runnerUp = Object.keys(last.tally).filter((k) => k !== winner).sort((a, b) => (units(last.tally[b]) > units(last.tally[a]) ? 1 : -1))[0];
  const plurality = view.pluralityWinner;

  return (
    <Paper as="section" aria-labelledby={id} className="story">
      <PanelHeader id={id} title="When the methods disagree" />
      <dl className="facts mb-3">
        <dt>Ranked choice</dt>
        <dd>
          <b>Ranked-choice winner: {winner}</b>
        </dd>
        <dt>Head to head</dt>
        <dd>
          <b>Condorcet winner: {cw}</b>
        </dd>
        {plurality ? (
          <>
            <dt>First choices only</dt>
            <dd>Plurality winner: {plurality}</dd>
          </>
        ) : null}
      </dl>
      <p>
        {cw} beats every other candidate one on one:{" "}
        {rivals.map((r, i) => (
          <span key={r}>
            {i > 0 ? (i === rivals.length - 1 ? " and " : ", ") : ""}
            <span className="n">{formatCount(matrix[cw]![r]!)}</span> to <span className="n">{formatCount(matrix[r]![cw]!)}</span> against {surname(r)}
          </span>
        ))}
        .
      </p>
      <p>
        Ranked choice looks at first choices first. {surname(cw)} had <span className="n">{formatVotes(first[cw] ?? "0")}</span>, {ORDINAL[place] ?? `number ${place + 1}`} of{" "}
        {Object.keys(first).length}, and was eliminated
        {outAt >= 0 ? ` after round ${outAt + 1}` : ""}, so those head-to-head wins never came into play.
        {runnerUp ? (
          <>
            {" "}
            {surname(winner)} won the last round <span className="n">{formatVotes(last.tally[winner]!)}</span> to{" "}
            <span className="n">{formatVotes(last.tally[runnerUp]!)}</span> over {surname(runnerUp)}.
          </>
        ) : null}
      </p>
      {plurality && plurality !== winner ? (
        <p>
          Counting first choices alone would have elected {plurality}
          {plurality !== cw ? ": three methods, three different winners." : "."}
        </p>
      ) : null}
    </Paper>
  );
}
