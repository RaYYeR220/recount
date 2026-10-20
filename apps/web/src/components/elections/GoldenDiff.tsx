import type { GoldenMismatch, GoldenRound } from "@recount/engine";
import { Badge } from "@/components/ui/Badge";
import { CheckIcon } from "@/components/ui/icons";
import { PanelHeader, Paper } from "@/components/ui/Surface";
import { figuresLine } from "@/lib/recount";
import { formatVotes } from "@/lib/votes";
import type { MatchLabel } from "./matchLabel";

export type GoldenDiffProps = {
  official: { rounds: GoldenRound[]; winners: string[] };
  /** Our winners, display names. */
  winners: string[];
  cells: number;
  mismatches: GoldenMismatch[];
  label: MatchLabel;
  /** "the official count", or "the city's published round results" for Minneapolis. */
  against: string;
  id?: string;
};

const LINE_LABEL = { inactive: "Inactive ballots", exhausted: "Exhausted" } as const;

function Cell({ official, miss }: { official: string; miss: GoldenMismatch | undefined }) {
  if (miss) {
    return (
      <td className="num miss">
        {formatVotes(official)}
        <small>
          ours {miss.actual === "-" ? "—" : formatVotes(miss.actual)}
        </small>
      </td>
    );
  }
  return (
    <td className="num hit">
      {formatVotes(official)}
      <small>
        <CheckIcon className="inline h-2.5 w-2.5" /> <span className="sr-only">ours </span>same
      </small>
    </td>
  );
}

/** Every figure the official report prints, held against the replay's own count. */
export function GoldenDiff({ official, winners, cells, mismatches, label, against, id = "golden-h" }: GoldenDiffProps) {
  const names: string[] = [];
  for (const r of official.rounds) for (const n of Object.keys(r.tally)) if (!names.includes(n)) names.push(n);
  const lines = (["inactive", "exhausted"] as const).filter((k) => official.rounds.some((r) => r[k] !== undefined));
  const missAt = (round: number, candidate: string) => mismatches.find((m) => m.round === round && m.candidate === candidate);
  const winnersMiss = mismatches.find((m) => m.candidate === "winners");

  return (
    <Paper as="section" aria-labelledby={id}>
      <PanelHeader id={id} title={`Against ${against}`} description="Every figure the published report prints, next to this replay's count." />
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="title text-2xl" data-testid="golden-summary">
          {figuresLine(cells, mismatches.length, against)}
        </p>
        <Badge tone={label.tone}>{label.text}</Badge>
      </div>
      <div className="round-scroll" role="region" aria-labelledby={id} tabIndex={0}>
        <table className="round-ledger">
          <caption className="sr-only">Official figures by round; cells that differ show this replay&apos;s figure under the official one</caption>
          <thead>
            <tr>
              <th scope="col">Published report</th>
              {official.rounds.map((r) => (
                <th key={r.round} scope="col">
                  Round {r.round}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {names.map((name) => (
              <tr key={name}>
                <th scope="row">{name}</th>
                {official.rounds.map((r) =>
                  r.tally[name] === undefined ? (
                    <td key={r.round} className="gone">
                      <span aria-hidden="true">—</span>
                      <span className="sr-only">not reported</span>
                    </td>
                  ) : (
                    <Cell key={r.round} official={r.tally[name]} miss={missAt(r.round, name)} />
                  ),
                )}
              </tr>
            ))}
            {lines.map((line) => (
              <tr key={line} className="inactive">
                <th scope="row">{LINE_LABEL[line]}</th>
                {official.rounds.map((r) =>
                  r[line] === undefined ? (
                    <td key={r.round} className="gone">
                      <span aria-hidden="true">—</span>
                    </td>
                  ) : (
                    <Cell key={r.round} official={r[line]} miss={missAt(r.round, line)} />
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint-line">
        Winners in the report: <b className="text-ink">{official.winners.join(", ")}</b>.{" "}
        {winnersMiss ? (
          <span className="font-bold text-fail">This replay elects {winners.join(", ")}.</span>
        ) : (
          <span>This replay elects the same.</span>
        )}
      </p>
    </Paper>
  );
}
