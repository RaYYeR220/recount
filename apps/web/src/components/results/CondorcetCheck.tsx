import { Callout } from "@/components/ui/Callout";
import { PanelHeader, Paper } from "@/components/ui/Surface";
import { formatCount, placesOf, sharedPlaces, toUnits } from "@/lib/votes";
import type { CountView } from "./model";

const MAX_SHOWN = 6;

/** Who goes in the matrix: everyone when few, else winners and the strongest first choices. */
function matrixOptions(view: Pick<CountView, "options" | "pairwise" | "winners" | "pluralityWinner" | "rounds">): string[] {
  const all = view.options.filter((o) => view.pairwise.matrix[o] !== undefined);
  if (all.length <= MAX_SHOWN) return all;
  const first = view.rounds[0]?.tally ?? {};
  const strength = (o: string) => (first[o] === undefined ? 0n : toUnits(first[o], placesOf(first[o])));
  const picked = new Set<string>([...view.winners, view.pairwise.condorcetWinner, view.pluralityWinner].filter((o): o is string => !!o && all.includes(o)));
  for (const o of [...all].sort((a, b) => (strength(b) > strength(a) ? 1 : strength(b) < strength(a) ? -1 : 0))) {
    if (picked.size >= MAX_SHOWN) break;
    picked.add(o);
  }
  return all.filter((o) => picked.has(o));
}

export type CondorcetCheckProps = {
  view: Pick<CountView, "options" | "pairwise" | "winners" | "pluralityWinner" | "rounds" | "seats" | "noun" | "shortLabels">;
  /** The poll is still open: the count so far has leaders, not winners. */
  provisional?: boolean;
  id?: string;
};

/** Options with the most votes in round 1. */
function firstRoundLeaders(rounds: CountView["rounds"]): string[] {
  const tally = rounds[0]?.tally ?? {};
  const dp = sharedPlaces(Object.values(tally));
  const units = (o: string) => toUnits(tally[o]!, dp);
  const top = Object.keys(tally).reduce((m, o) => (units(o) > m ? units(o) : m), -1n);
  return Object.keys(tally).filter((o) => units(o) === top);
}

/** A short name on screen, the full one for screen readers. */
function Name({ label, short }: { label: string; short?: string }) {
  if (!short || short === label) return label;
  return (
    <>
      <span aria-hidden="true" title={label}>
        {short}
      </span>
      <span className="sr-only">{label}</span>
    </>
  );
}

/** Head-to-head check: does any option beat every other one, and is it the ranked-choice winner? */
export function CondorcetCheck({ view, provisional, id = "condorcet-h" }: CondorcetCheckProps) {
  const { matrix, condorcetWinner: cw } = view.pairwise;
  const noun = view.noun ?? "option";
  const agrees = cw !== null && view.winners.includes(cw);
  const shown = matrixOptions(view);
  const total = view.options.filter((o) => matrix[o] !== undefined).length;
  const plurality = view.pluralityWinner;
  // Round 1 can count a ballot plurality can't: one that marks two first choices and goes on to its next rank.
  const pluralityDiffers = plurality !== null && !firstRoundLeaders(view.rounds).includes(plurality);

  return (
    <Paper as="section" aria-labelledby={id}>
      <PanelHeader id={id} title="Condorcet check" />
      {cw === null ? (
        <Callout tone="info">No {noun} beats every other one head to head, so there is no Condorcet winner to compare.</Callout>
      ) : agrees ? (
        <Callout tone="match">
          <b>
            Condorcet winner: {cw}.{" "}
            {view.seats > 1 ? (provisional ? "It also leads for a seat." : "It is also elected.") : "Ranked choice and the head-to-head check agree."}
          </b>
        </Callout>
      ) : (
        <Callout tone="warn">
          <b>Condorcet winner: {cw}.</b> The ranked-choice{" "}
          {view.seats > 1
            ? provisional
              ? "count so far does not put it ahead"
              : "count does not elect it"
            : provisional
              ? "leader is different"
              : "winner is different"}
          : {cw} beats every other {noun} head to head.
        </Callout>
      )}
      {plurality && !view.winners.includes(plurality) ? (
        <p className="hint-line">
          Plurality would have picked {plurality}
          {pluralityDiffers ? ": it counts only clean first choices, and a ballot that marks two first choices counts for nobody." : "."}
        </p>
      ) : null}
      {shown.length > 1 ? (
        <div className="pair-scroll" role="region" aria-labelledby={`${id}-cap`} tabIndex={0}>
          <table className="pair">
            <caption id={`${id}-cap`} className="sr-only">
              Head to head: ballots ranking the row {noun} above the column {noun}
            </caption>
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">{noun === "candidate" ? "Candidate" : "Option"}</span>
                </th>
                {shown.map((o) => (
                  <th key={o} scope="col">
                    <Name label={o} short={view.shortLabels?.[o]} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((a) => (
                <tr key={a}>
                  <th scope="row">
                    <Name label={a} short={view.shortLabels?.[a]} />
                  </th>
                  {shown.map((b) =>
                    a === b ? (
                      <td key={b} className="self">
                        <span aria-hidden="true">—</span>
                      </td>
                    ) : (
                      <td key={b} className={matrix[a]![b]! > matrix[b]![a]! ? "w" : undefined}>
                        {formatCount(matrix[a]![b]!)}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className="hint-line">
        Each cell counts the ballots that rank the row {noun} above the column {noun}; green marks the winner of that pair.
        {shown.length < total ? ` Showing ${shown.length} of ${total} ${noun}s.` : ""}
      </p>
    </Paper>
  );
}
