import {
  pairwise,
  pluralityWinner,
  presetRules,
  tabulate,
  toRctabSummary,
  type BallotPattern,
  type Candidate,
  type PairwiseResult,
  type PresetId,
  type RctabSummary,
  type Rules,
  type TabulationResult,
} from "@recount/engine";
import type { PollRow } from "../polls/detail";
import type { Cvr } from "./cvr";
import { serializeRounds, type ResultRound } from "./serialize";

export type CountedResults = {
  totalBallots: number;
  seats: number;
  /** Option labels in ballot order; they double as candidate ids in the count. */
  candidates: string[];
  rounds: ResultRound[];
  winners: string[];
  pairwise: PairwiseResult;
  condorcetWinner: string | null;
  pluralityWinner: string | null;
  cvrSha256: string;
  rules: Rules;
};

/** The first 15 hex digits of the CVR hash, as the decimal Java long RCTab expects. */
export function seedFromSha256(sha256: string): string {
  return BigInt(`0x${sha256.slice(0, 15)}`).toString();
}

export function pollRules(poll: Pick<PollRow, "presetId" | "seats" | "maxRanks">, cvrSha256: string): Rules {
  const rules = presetRules(poll.presetId as PresetId, poll.seats);
  rules.maxRankingsAllowed = poll.maxRanks ?? "max";
  if (rules.tiebreakMode !== "useCandidateOrder") rules.randomSeed = seedFromSha256(cvrSha256);
  return rules;
}

export function patternsFromRows(rows: string[][]): BallotPattern[] {
  const patterns = new Map<string, { ranking: string[][]; count: number }>();
  for (const row of rows) {
    const ranked = row.filter((label) => label !== "");
    const key = JSON.stringify(ranked);
    const pattern = patterns.get(key);
    if (pattern) pattern.count++;
    else patterns.set(key, { ranking: ranked.map((label) => [label]), count: 1 });
  }
  return [...patterns.values()];
}

function emptyPairwise(labels: string[]): PairwiseResult {
  const matrix = Object.fromEntries(
    labels.map((a) => [a, Object.fromEntries(labels.filter((b) => b !== a).map((b) => [b, 0]))]),
  );
  return { matrix, condorcetWinner: null, condorcetLoser: null };
}

export function toRctabForPoll(
  result: TabulationResult,
  poll: Pick<PollRow, "title">,
  closedAt: Date | null,
): RctabSummary {
  return toRctabSummary(result, {
    contest: poll.title,
    date: closedAt ? closedAt.toISOString().slice(0, 10) : "",
    jurisdiction: "Recount",
  });
}

/**
 * Counts the CVR exactly as a recount from the published CSV would: candidates are
 * the labels in ballot order and the tiebreak seed comes from the CVR hash.
 */
export function tabulatePoll(
  poll: Pick<PollRow, "title" | "presetId" | "seats" | "maxRanks">,
  cvr: Pick<Cvr, "labels" | "rows" | "sha256">,
  closedAt: Date | null,
): { results: CountedResults; rctab: RctabSummary } {
  const rules = pollRules(poll, cvr.sha256);
  const candidates: Candidate[] = cvr.labels.map((label) => ({ id: label, name: label }));
  const ballots = patternsFromRows(cvr.rows);
  const empty = ballots.length === 0;
  const result: TabulationResult = empty
    ? { rounds: [], winners: [], totalBallots: 0, undervotes: 0, rules, candidates }
    : tabulate({ candidates, ballots, rules });
  const matrix = empty ? emptyPairwise(cvr.labels) : pairwise(candidates, ballots);

  return {
    results: {
      totalBallots: result.totalBallots,
      seats: poll.seats,
      candidates: cvr.labels,
      rounds: serializeRounds(result),
      winners: result.winners,
      pairwise: matrix,
      condorcetWinner: matrix.condorcetWinner,
      pluralityWinner: empty ? null : pluralityWinner(candidates, ballots),
      cvrSha256: cvr.sha256,
      rules,
    },
    rctab: toRctabForPoll(result, poll, closedAt),
  };
}
