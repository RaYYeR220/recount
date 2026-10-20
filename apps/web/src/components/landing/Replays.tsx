import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { cx } from "@/lib/cx";
import { getReplays } from "./loaders";
import type { ReplayRow } from "./replaysData";
import { Section } from "./Section";
import { capitalize, countWord } from "./words";

/** One pip per figure in the report; dense counts become one bar per state. */
function Pips({ row }: { row: ReplayRow }) {
  const missed = row.cells - row.matched;
  const dense = row.cells > 60;
  return (
    <span className={cx("lp-pips", dense && "is-dense")} aria-hidden="true">
      {dense ? (
        <>
          <i style={{ flex: row.matched }} />
          {missed > 0 ? <i className="x" style={{ flex: missed }} /> : null}
        </>
      ) : (
        Array.from({ length: row.cells }, (_, i) => <i key={i} className={i >= row.matched ? "x" : undefined} />)
      )}
    </span>
  );
}

/** The election library as a ledger: every replay, how many of the report's figures it matches, and the honest label. */
export async function Replays() {
  const rows = await getReplays();
  const exact = rows.filter((r) => r.matched === r.cells).length;
  const near = rows.length - exact;

  return (
    <Section
      id="replays"
      tone="deep"
      title={`${capitalize(countWord(rows.length))} real elections, recounted from their ballots`}
      lede={`${exact} of ${rows.length} match the official count figure for figure.${near > 0 ? ` The other ${near} use FairVote's copy of the ballots and land within a few votes, and their pages show exactly where.` : ""}`}
    >
      <div className="paper lp-ledger-sheet">
        <table className="ledger lp-replays">
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
                <span className="sr-only">Replay</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.slug}>
                <td className="c-title">
                  <div className="lp-rp-title">{row.title}</div>
                  <div className="lp-rp-sub">{row.source}</div>
                </td>
                <td className="c-meta c-seats">{row.seats === 1 ? "1 seat" : `${row.seats} seats`}</td>
                <td className="num c-meta">
                  {row.ballots}
                  <span className="lp-unit"> {row.ballots === "1" ? "ballot" : "ballots"}</span>
                </td>
                <td className="num c-meta">
                  {row.rounds}
                  <span className="lp-unit"> {row.rounds === 1 ? "round" : "rounds"}</span>
                </td>
                <td className="c-figs">
                  <div className="lp-rp-figs">
                    <div className="lp-rp-figs-line">
                      <span className="lp-rp-count num">
                        {row.matched} of {row.cells}
                      </span>
                      <Pips row={row} />
                    </div>
                    <Badge tone={row.label.tone}>{row.label.text}</Badge>
                  </div>
                </td>
                <td className="c-win">
                  <div className="lp-rp-win">
                    {row.winners.join(", ")}
                    {row.condorcet ? <small>Condorcet winner: {row.condorcet}</small> : null}
                  </div>
                </td>
                <td className="c-open">
                  <Link className="lp-rp-open" href={`/elections/${row.slug}`}>
                    Replay<span className="sr-only"> {row.title}</span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="lp-replays-foot">
        Ballots come from each jurisdiction&apos;s public cast-vote record, or FairVote&apos;s normalised copy where the city&apos;s own file is gone. The
        official figures are transcribed from the published round-by-round reports, each with its own SHA-256.
      </p>
    </Section>
  );
}
