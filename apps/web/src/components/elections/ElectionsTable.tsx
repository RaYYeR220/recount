import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { personName } from "@/lib/names";
import { formatCount } from "@/lib/votes";
import type { MatchLabel } from "./matchLabel";

export type ElectionRow = {
  slug: string;
  title: string;
  publisher: string;
  date: string;
  seats: number;
  ballots: number;
  rounds: number;
  winners: string[];
  /** Head-to-head winner when ranked choice elected someone else (one-seat contests). */
  condorcetDiffers: string | null;
  cells: number | null;
  mismatches: number;
  label: MatchLabel | null;
};

function longDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

/** One mark per compared figure; a solid bar when there are too many to draw apart. */
function Pips({ cells, mismatches }: { cells: number; mismatches: number }) {
  const matched = cells - mismatches;
  if (cells > 60) {
    return (
      <span className="pips dense" aria-hidden="true">
        <i style={{ flex: matched }} />
        {mismatches ? <i className="x" style={{ flex: mismatches }} /> : null}
      </span>
    );
  }
  return (
    <span className="pips" aria-hidden="true">
      {Array.from({ length: cells }, (_, i) => (
        <i key={i} className={i >= matched ? "x" : undefined} />
      ))}
    </span>
  );
}

/** The replay library: each election, how many official figures it reproduces, and who won. */
export function ElectionsTable({ rows }: { rows: ElectionRow[] }) {
  return (
    <div className="ledger-sheet paper">
      <table className="ledger replays">
        <caption className="sr-only">Replays of official ranked-choice counts and how closely they match</caption>
        <thead>
          <tr>
            <th scope="col">Election</th>
            <th scope="col">Seats</th>
            <th scope="col" className="num">
              Ballots
            </th>
            <th scope="col" className="num">
              Rounds
            </th>
            <th scope="col">Figures that match</th>
            <th scope="col">Winner</th>
            <th scope="col">
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.slug}>
              <td className="c-title">
                <div className="rp-title">{r.title}</div>
                <div className="rp-sub">
                  {r.publisher.replace(/, Harvard Dataverse.*$/, "")}, {longDate(r.date)}
                </div>
              </td>
              <td className="c-meta c-seats">{r.seats === 1 ? "1 seat" : `${r.seats} seats`}</td>
              <td className="num c-meta c-ballots">
                {formatCount(r.ballots)}
                <span className="sr-only"> ballots</span>
              </td>
              <td className="num c-meta c-rounds">
                {r.rounds}
                <span className="sr-only"> rounds</span>
              </td>
              <td className="c-figs">
                {r.cells !== null && r.label ? (
                  <div className="rp-figs">
                    <div className="rp-figs-line">
                      <span className="rp-count num">
                        {r.cells - r.mismatches} of {r.cells}
                      </span>
                      <Pips cells={r.cells} mismatches={r.mismatches} />
                    </div>
                    <Badge tone={r.label.tone}>{r.label.text}</Badge>
                  </div>
                ) : (
                  <span className="text-ink-3">No official report</span>
                )}
              </td>
              <td className="c-win">
                <div className="rp-win">
                  {r.winners.map(personName).join(", ")}
                  {r.condorcetDiffers ? <small>Condorcet winner: {personName(r.condorcetDiffers)}</small> : null}
                </div>
              </td>
              <td className="c-open">
                <Link className="rp-open" href={`/elections/${r.slug}`}>
                  Replay<span className="sr-only"> {r.title}</span>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
