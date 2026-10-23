import type { ReactNode } from "react";
import { Chit } from "@/components/ui/Chit";
import { PanelHeader, Paper } from "@/components/ui/Surface";
import { isTrailing } from "@/lib/countStory";
import { findTies, type Tie } from "@/lib/countTies";
import { cx } from "@/lib/cx";
import { ballotsText } from "@/lib/pollText";
import { formatDelta, formatUnits, formatVotes, sharedPlaces, toUnits } from "@/lib/votes";
import type { ResultRound } from "@/server/results/serialize";
import { chitOf, type CountView } from "./model";

export type RoundTableProps = {
  view: Pick<CountView, "rounds" | "options" | "seats" | "writeIns" | "totalBallots" | "noun">;
  /** Quiet note beside the heading. Default: what the figures are. */
  note?: ReactNode;
  /** The poll is still open: leaders, not winners. */
  provisional?: boolean;
  id?: string;
};

function placesOf(rounds: readonly ResultRound[]): number {
  return sharedPlaces(rounds.flatMap((r) => [r.threshold, ...Object.values(r.tally), ...Object.values(r.inactive)]));
}

function inactiveOf(r: ResultRound, dp: number): bigint {
  return Object.values(r.inactive).reduce((a, v) => a + toUnits(v, dp), 0n);
}

/** The word under a figure: elected or eliminated this round, and whether a tiebreak decided it. */
function tagOf(option: string, r: ResultRound, ties: readonly Tie[], provisional: boolean): { text: string; out: boolean } | null {
  const tie = ties.find((x) => x.round === r.round && x.tied.includes(option));
  if (r.elected.includes(option)) {
    if (provisional) return { text: tie ? "Ahead on tiebreak" : "Leading", out: false };
    return { text: tie ? "Elected on tiebreak" : "Elected", out: false };
  }
  if (r.eliminated.includes(option)) return { text: tie ? "Eliminated on tiebreak" : "Eliminated", out: true };
  if (tie?.kind === "seat") return { text: provisional ? "Behind on tiebreak" : "Lost tiebreak", out: true };
  return null;
}

/**
 * Every option's figure in every round, with the change from the round before and
 * the round it was elected or eliminated. Scrolls sideways inside its card.
 */
export function RoundTable({ view, note, provisional = false, id = "rounds-h" }: RoundTableProps) {
  const { rounds, seats } = view;
  const dp = placesOf(rounds);
  const multi = seats > 1;
  const ties = findTies(rounds);
  const rows = view.options.filter((o) => rounds.some((r) => r.tally[o] !== undefined));
  const lastInactive = rounds.length ? inactiveOf(rounds.at(-1)!, dp) : 0n;
  const fallbackNote =
    dp > 0
      ? `Fractional votes at ${dp} decimal places, truncated, as RCTab counts them.`
      : `${ballotsText(view.totalBallots)}, ${lastInactive === 0n ? "nothing inactive" : `${formatUnits(lastInactive, dp)} inactive by the last round`}.`;

  return (
    <Paper as="section" aria-labelledby={id}>
      <PanelHeader id={id} title="Round by round" description={note ?? fallbackNote} />
      <div className="round-scroll" role="region" aria-labelledby={id} tabIndex={0}>
        <table className="round-ledger">
          <caption className="sr-only">Votes for each option in each round</caption>
          <thead>
            <tr>
              <th scope="col">{view.noun === "candidate" ? "Candidate" : "Option"}</th>
              {rounds.map((r, i) => {
                const trailing = isTrailing(rounds, i, seats);
                return (
                  <th key={r.round} scope="col" className={cx(trailing && "trail")}>
                    Round {r.round}
                    {trailing ? <small>seats filled</small> : i === 0 ? <small>first choices</small> : null}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o}>
                <th scope="row">
                  <span className="opt">
                    <Chit index={chitOf(o, view)} size={14} />
                    {o}
                  </span>
                </th>
                {rounds.map((r, i) => {
                  const value = r.tally[o];
                  const trailing = isTrailing(rounds, i, seats);
                  if (value === undefined)
                    return (
                      <td key={r.round} className={cx("gone", trailing && "trail")}>
                        <span aria-hidden="true">—</span>
                        <span className="sr-only">out</span>
                      </td>
                    );
                  const prev = i > 0 ? rounds[i - 1]!.tally[o] : undefined;
                  const delta = prev === undefined ? null : formatDelta(toUnits(value, dp) - toUnits(prev, dp), dp);
                  const tag = tagOf(o, r, ties, provisional);
                  return (
                    <td key={r.round} className={cx("num", r.elected.includes(o) && "el", trailing && "trail")}>
                      {formatVotes(value)}
                      {delta ? <span className={cx("d", delta.startsWith("−") && "neg")}>{delta}</span> : null}
                      {tag ? <span className={cx("tag", tag.out && "out")}>{tag.text}</span> : null}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="inactive">
              <th scope="row">
                <span className="opt">
                  <Chit index="inactive" size={14} />
                  Inactive
                </span>
              </th>
              {rounds.map((r, i) => (
                <td key={r.round} className={cx("num", isTrailing(rounds, i, seats) && "trail")}>
                  {formatUnits(inactiveOf(r, dp), dp)}
                </td>
              ))}
            </tr>
            <tr className="quota">
              <th scope="row">{multi ? "Quota" : "Needed to win"}</th>
              {rounds.map((r, i) => (
                <td key={r.round} className={cx("num", isTrailing(rounds, i, seats) && "trail")}>
                  {formatVotes(r.threshold)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </Paper>
  );
}
