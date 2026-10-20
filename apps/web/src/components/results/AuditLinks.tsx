import type { PresetId } from "@recount/engine";
import { Badge } from "@/components/ui/Badge";
import { Callout } from "@/components/ui/Callout";
import { Code } from "@/components/ui/CodeBlock";
import { PanelHeader, Paper } from "@/components/ui/Surface";
import type { ResultRound } from "@/server/results/serialize";
import { formatCount } from "@/lib/votes";
import { BrowserRecount } from "./BrowserRecount";

export type AuditLinksProps = {
  slug: string;
  sha256: string;
  ballots: number;
  /**
   * public-closed: the record is published, so link it and offer the recount.
   * public-open: only the live RCTab summary; the record comes at close.
   * private: only the owner may read it, through an API token.
   */
  access: "public-closed" | "public-open" | "private";
  recount: { presetId: PresetId; seats: number; maxRanks: number | null; candidates: string[]; winners: string[]; rounds: ResultRound[] };
  id?: string;
};

export const cvrUrl = (slug: string) => `/api/v1/polls/${encodeURIComponent(slug)}/cvr?format=csv`;
export const rctabUrl = (slug: string) => `/api/v1/polls/${encodeURIComponent(slug)}/results?format=rctab`;

function Sha({ sha256 }: { sha256: string }) {
  return (
    <span className="sub sha">
      SHA-256 <b>{sha256.slice(0, 12)}</b>
      {sha256.slice(12)}
    </span>
  );
}

/** The cast-vote record, the RCTab summary and the recount that checks them. */
export function AuditLinks({ slug, sha256, ballots, access, recount, id = "audit-h" }: AuditLinksProps) {
  return (
    <Paper as="section" aria-labelledby={id}>
      <PanelHeader id={id} title="Audit" />
      {access === "private" ? (
        <Callout tone="info">
          Only you can see these results, so the cast-vote record and the RCTab summary are served to your API tokens, not to a public link:{" "}
          <Code>GET /api/v1/polls/{slug}/cvr?format=csv</Code>
        </Callout>
      ) : (
        <ul className="audit-list">
          <li>
            {access === "public-closed" ? (
              <>
                <a href={cvrUrl(slug)}>Cast-vote record (CSV)</a>
                <Badge>
                  {formatCount(ballots)} {ballots === 1 ? "row" : "rows"}
                </Badge>
                <Sha sha256={sha256} />
              </>
            ) : (
              <>
                <span className="font-bold">Cast-vote record (CSV)</span>
                <Badge tone="info">At close</Badge>
                <span className="sub">Published with its SHA-256 when the poll closes, so nobody can recount a moving target.</span>
              </>
            )}
          </li>
          <li>
            <a href={rctabUrl(slug)}>RCTab summary (JSON)</a>
            <Badge>RCTab format</Badge>
            <span className="sub">{access === "public-open" ? "The count so far, round by round, in the format election software reads." : "Round-by-round summary that election software reads."}</span>
          </li>
        </ul>
      )}
      {access === "public-closed" ? (
        <BrowserRecount
          request={{ kind: "poll", csvUrl: cvrUrl(slug), presetId: recount.presetId, seats: recount.seats, maxRanks: recount.maxRanks, candidates: recount.candidates }}
          published={{ sha256, winners: recount.winners, rounds: recount.rounds }}
          seats={recount.seats}
        />
      ) : null}
    </Paper>
  );
}
