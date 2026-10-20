import type { ElectionDataset, Golden } from './dataset';
import { type Fixed, formatFixed, parseFixed } from './fixed';
import type { RoundResult, TabulationResult } from './result';
import type { CandidateId } from './types';

export interface GoldenMismatch {
  round: number;
  /** Candidate name, or `inactive` / `exhausted` / `winners`. */
  candidate: string;
  expected: string;
  actual: string;
}

export interface GoldenComparison {
  cells: number;
  mismatches: GoldenMismatch[];
}

function inactiveTotal(r: RoundResult): Fixed {
  const { overvotes, skippedRankings, repeatedRankings, exhaustedChoices } = r.inactive;
  return overvotes + skippedRankings + repeatedRankings + exhaustedChoices;
}

/** Compares every number an official report prints with the engine's count of the same ballots. */
export function compareToGolden(
  result: TabulationResult,
  dataset: Pick<ElectionDataset, 'candidates' | 'reportConvention'>,
  golden: Golden,
): GoldenComparison {
  const dp = result.rules.decimalPlacesForVoteArithmetic;
  const idByName = new Map<string, CandidateId>(dataset.candidates.map((c) => [c.name, c.id]));
  const nameById = new Map<CandidateId, string>(dataset.candidates.map((c) => [c.id, c.name]));
  const mismatches: GoldenMismatch[] = [];
  let cells = 0;

  const check = (round: number, candidate: string, expected: string, actual: Fixed | undefined) => {
    cells++;
    const want = parseFixed(expected, dp);
    if (actual === undefined || actual !== want) {
      mismatches.push({ round, candidate, expected, actual: actual === undefined ? '-' : formatFixed(actual, dp) });
    }
  };

  const firstInactive = result.rounds[0] ? inactiveTotal(result.rounds[0]) : 0n;
  for (const g of golden.rounds) {
    const r = result.rounds[g.round - 1];
    for (const [name, expected] of Object.entries(g.tally)) {
      const id = idByName.get(name);
      if (r === undefined || id === undefined) {
        check(g.round, name, expected, undefined);
        continue;
      }
      check(g.round, name, expected, Object.hasOwn(r.tally, id) ? r.tally[id]! : 0n);
    }
    for (const label of ['inactive', 'exhausted'] as const) {
      const expected = g[label];
      if (expected === undefined) continue;
      const total = r === undefined ? undefined : inactiveTotal(r);
      const shown =
        total === undefined ? undefined : dataset.reportConvention.inactive === 'afterFirstRound' ? total - firstInactive : total;
      check(g.round, label, expected, shown);
    }
  }

  cells++;
  const expectedWinners = [...golden.winners].sort();
  const actualWinners = result.winners.map((id) => nameById.get(id) ?? id).sort();
  if (expectedWinners.join('\n') !== actualWinners.join('\n')) {
    mismatches.push({ round: 0, candidate: 'winners', expected: expectedWinners.join(', '), actual: actualWinners.join(', ') });
  }
  return { cells, mismatches };
}
