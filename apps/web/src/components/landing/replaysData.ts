import { formatCount } from "@/lib/votes";
import type { ElectionReplay } from "@/server/elections";

export type MatchLabel = { tone: "match" | "warn"; text: string };

export type ReplayRow = {
  slug: string;
  title: string;
  /** "Board of Elections in the City of New York, June 24, 2025" */
  source: string;
  seats: number;
  ballots: string;
  rounds: number;
  cells: number;
  matched: number;
  label: MatchLabel;
  winners: string[];
  /** Set when one seat was up and the Condorcet winner is not the winner. */
  condorcet: string | null;
};

const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

/** Largest gap between a figure in the report and the replay's figure. */
function largestGap(mismatches: ReadonlyArray<{ expected: string; actual: string }>): number {
  let gap = 0;
  for (const m of mismatches) {
    const a = Number(m.expected);
    const b = Number(m.actual);
    gap = Math.max(gap, Number.isFinite(a) && Number.isFinite(b) ? Math.abs(a - b) : Infinity);
  }
  return gap;
}

/**
 * The honest label for a replay. Exact matches name what they match: the certified
 * count (New York City, Portland) or, for Minneapolis, the city's published round
 * results, which are never called certified. Anything else says how close it lands.
 */
export function matchLabel(slug: string, mismatches: ReadonlyArray<{ expected: string; actual: string }>): MatchLabel {
  if (mismatches.length > 0) {
    const gap = largestGap(mismatches);
    return {
      tone: "warn",
      text: Number.isFinite(gap) ? `Within ${formatCount(gap)} ${gap === 1 ? "vote" : "votes"} of the official count` : "Differs from the official count",
    };
  }
  if (slug.startsWith("minneapolis")) return { tone: "match", text: "Matches the city's published round results" };
  return { tone: "match", text: "Matches the certified count" };
}

/** "Last, First" from a CVR becomes "First Last". */
export function personName(name: string): string {
  return name.includes(",") ? name.split(",").map((s) => s.trim()).reverse().join(" ") : name;
}

export function buildReplayRow(replay: ElectionReplay, condorcetWinner: string | null): ReplayRow {
  const comparison = replay.comparison ?? { cells: 0, mismatches: [] };
  const winners = replay.winners.map(personName);
  return {
    slug: replay.slug,
    title: replay.title,
    source: `${replay.source.publisher.replace(/, Harvard Dataverse.*$/, "")}, ${longDate(replay.date)}`,
    seats: replay.seats,
    ballots: formatCount(replay.totalBallots),
    rounds: replay.rounds.length,
    cells: comparison.cells,
    matched: comparison.cells - comparison.mismatches.length,
    label: matchLabel(replay.slug, comparison.mismatches),
    winners,
    condorcet:
      replay.seats === 1 && condorcetWinner !== null && !replay.winners.includes(condorcetWinner) ? personName(condorcetWinner) : null,
  };
}
