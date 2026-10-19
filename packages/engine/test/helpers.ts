import { formatFixed, makeScale } from '../src/fixed';
import type { TabulationResult } from '../src/result';
import { DEFAULT_RULES, type Rules } from '../src/rules';
import { tabulate } from '../src/tabulate';
import type { BallotPattern, Candidate, Slot } from '../src/types';

export function cands(...ids: string[]): Candidate[] {
  return ids.map((id) => ({ id, name: id }));
}

/** `ballot(3, 'a', 'b')` is three ballots ranking a then b; '' is a skipped rank, 'a|b' an overvote. */
export function ballot(count: number, ...ranks: string[]): BallotPattern {
  const ranking: Slot[] = ranks.map((r) => (r === '' ? [] : r.split('|')));
  return { ranking, count };
}

export function count(candidates: Candidate[], ballots: BallotPattern[], rules: Partial<Rules> = {}): TabulationResult {
  return tabulate({ candidates, ballots, rules: { ...DEFAULT_RULES, ...rules } });
}

/** Round tallies as decimal strings, for readable expectations. */
export function tallies(result: TabulationResult): Array<Record<string, string>> {
  const dp = result.rules.decimalPlacesForVoteArithmetic;
  return result.rounds.map((r) => Object.fromEntries(Object.entries(r.tally).map(([k, v]) => [k, formatFixed(v, dp)])));
}

export function fmt(result: TabulationResult, v: bigint): string {
  return formatFixed(v, result.rules.decimalPlacesForVoteArithmetic);
}

/** Every ballot is somewhere in every round: with a candidate, inactive, an undervote or lost to truncation. */
export function expectConserved(result: TabulationResult): void {
  const scale = makeScale(result.rules.decimalPlacesForVoteArithmetic);
  for (const r of result.rounds) {
    const sum = (o: Record<string, bigint>) => Object.values(o).reduce((s, v) => s + v, 0n);
    const total =
      sum(r.tally) +
      sum(r.inactive as unknown as Record<string, bigint>) +
      r.residualSurplus +
      (r.finalRoundSurplus ?? 0n) +
      BigInt(result.undervotes) * scale;
    if (total !== BigInt(result.totalBallots) * scale) {
      throw new Error(`round ${r.round} does not balance: ${total} vs ${BigInt(result.totalBallots) * scale}`);
    }
  }
}
