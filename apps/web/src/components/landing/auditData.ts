import { tabulatePoll } from "@/server/results/tabulatePoll";
import { showcaseCvr, showcasePoll } from "@/server/seed/showcaseCvr";

export const AUDIT_SLUG = "lunch-closed";

/** What the recount needs besides the CSV: the poll's options and rules, as its public page shows them. */
export type RecountPoll = { options: string[]; presetId: string; seats: number; maxRanks: number | null };

export type Published = { winners: string[]; rounds: number; ballots: number; sha256: string };

export type AuditData = {
  slug: string;
  title: string;
  /** The CSV exactly as /api/v1/polls/<slug>/cvr?format=csv serves it. */
  csv: string;
  sha256: string;
  /** The RCTab summary with its config folded (its date is the day the demo was seeded). */
  rctab: string;
  published: Published;
  poll: RecountPoll;
  cvrUrl: string;
  rctabUrl: string;
};

/** The JSON with "config" folded to its contest name: the rounds and summary as served. */
function rctabExcerpt(summary: { config: { contest?: string }; jsonFormatVersion: string; results: unknown; summary: unknown }): string {
  const indent = (text: string) => text.replace(/\n/g, "\n  ");
  return [
    "{",
    `  "config": { "contest": ${JSON.stringify(summary.config.contest ?? "")}, … },`,
    `  "jsonFormatVersion": ${JSON.stringify(summary.jsonFormatVersion)},`,
    `  "results": ${indent(JSON.stringify(summary.results, null, 2))},`,
    `  "summary": ${indent(JSON.stringify(summary.summary, null, 2))}`,
    "}",
  ].join("\n");
}

/**
 * The lunch vote's audit files, worked out from the seed with the app's own CVR and
 * count code: the same bytes and hash the API serves for the seeded poll.
 */
export function buildAudit(slug: string = AUDIT_SLUG): AuditData {
  const spec = showcasePoll(slug);
  const cvr = showcaseCvr(slug);
  const { results, rctab } = tabulatePoll(spec, cvr, null);
  return {
    slug,
    title: spec.title,
    csv: cvr.csv,
    sha256: cvr.sha256,
    rctab: rctabExcerpt(rctab),
    published: { winners: results.winners, rounds: results.rounds.length, ballots: results.totalBallots, sha256: results.cvrSha256 },
    poll: { options: spec.options, presetId: spec.presetId, seats: spec.seats, maxRanks: spec.maxRanks },
    cvrUrl: `/api/v1/polls/${slug}/cvr?format=csv`,
    rctabUrl: `/api/v1/polls/${slug}/results?format=rctab`,
  };
}
