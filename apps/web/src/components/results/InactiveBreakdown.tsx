import type { ReactNode } from "react";
import { Caption } from "@/components/table/Caption";
import { PanelHeader, Paper } from "@/components/ui/Surface";
import { inactiveRows, inactiveSummary } from "@/lib/countStory";
import { formatVotes } from "@/lib/votes";
import type { CountView } from "./model";

export type InactiveBreakdownProps = {
  view: Pick<CountView, "rounds" | "seats">;
  /** A line on how an official report counts the same ballots. */
  note?: ReactNode;
  id?: string;
};

/** Why ballots stopped counting, by reason and round. */
export function InactiveBreakdown({ view, note, id = "inactive-h" }: InactiveBreakdownProps) {
  const rows = inactiveRows(view.rounds);
  const unit = view.seats > 1 ? "votes" : "ballots";
  return (
    <Paper as="section" aria-labelledby={id} className="story">
      <PanelHeader id={id} title="Inactive ballots" description="Ballots that stopped counting, and why. Totals build up round by round." />
      <p>
        <Caption parts={inactiveSummary(view.rounds, unit)} />
      </p>
      {note ? <p className="hint-line">{note}</p> : null}
      {rows.length > 0 ? (
        <div className="round-scroll mt-3" role="region" aria-label="Inactive ballots by reason" tabIndex={0}>
          <table className="round-ledger">
            <caption className="sr-only">Inactive ballots by reason, cumulative, in each round</caption>
            <thead>
              <tr>
                <th scope="col">Reason</th>
                {view.rounds.map((r) => (
                  <th key={r.round} scope="col">
                    Round {r.round}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <th scope="row">{row.label}</th>
                  {row.perRound.map((v, i) => (
                    <td key={i} className="num">
                      {formatVotes(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Paper>
  );
}
