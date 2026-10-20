import type { ReactNode } from "react";
import { Chit } from "@/components/ui/Chit";
import { PanelHeader, Paper } from "@/components/ui/Surface";
import { isTrailing } from "@/lib/countStory";
import { cx } from "@/lib/cx";
import { formatDelta, formatUnits, formatVotes, sharedPlaces, toUnits } from "@/lib/votes";
import type { ResultRound } from "@/server/results/serialize";
import { chitOf, type CountView } from "./model";

export type RoundTableProps = {
  view: Pick<CountView, "rounds" | "options" | "seats" | "writeIns" | "totalBallots" | "noun">;
  /** Quiet note beside the heading. Default: what the figures are. */
  note?: ReactNode;
  id?: string;
};

function placesOf(rounds: readonly ResultRound[]): number {
  return sharedPlaces(rounds.flatMap((r) => [r.threshold, ...Object.values(r.tally), ...Object.values(r.inactive)]));
}

function inactiveOf(r: ResultRound, dp: number): bigint {
  return Object.values(r.inactive).reduce((a, v) => a + toUnits(v, dp), 0n);
}

/**
 * Every option's figure in every round, with the change from the round before and
 * the round it was elected or eliminated. Scrolls sideways inside its card.
 */
export function RoundTable({ view, note, id = "rounds-h" }: RoundTableProps) {
  const { rounds, seats } = view;
  const dp = placesOf(rounds);
  const multi = seats > 1;
  const rows = view.options.filter((o) => rounds.some((r) => r.tally[o] !== undefined));
  const lastInactive = rounds.length ? inactiveOf(rounds.at(-1)!, dp) : 0n;
  const fallbackNote =
    dp > 0
      ? `Fractional votes at ${dp} decimal places, truncated, as RCTab counts them.`
      : `${view.totalBallots.toLocaleString("en-US")} ballots, ${lastInactive === 0n ? "nothing inactive" : `${formatUnits(lastInactive, dp)} inactive by the last round`}.`;

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
                  const elected = r.elected.includes(o);
                  const out = r.eliminated.includes(o);
                  return (
                    <td key={r.round} className={cx("num", elected && "el", trailing && "trail")}>
                      {formatVotes(value)}
                      {delta ? <span className={cx("d", delta.startsWith("−") && "neg")}>{delta}</span> : null}
                      {elected ? <span className="tag">Elected</span> : out ? <span className="tag out">Eliminated</span> : null}
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
