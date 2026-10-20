import type { BallotPattern, Candidate, CandidateId } from './types';
import { UNKNOWN_OVERVOTE_MARK } from './types';
import { record } from './validate';

export interface PairwiseResult {
  /** matrix[a][b]: ballots ranking a above b (a ranked and b not counts too). */
  matrix: Record<CandidateId, Record<CandidateId, number>>;
  condorcetWinner: CandidateId | null;
  condorcetLoser: CandidateId | null;
}

const contenders = (candidates: readonly Candidate[]) =>
  candidates.filter((c) => !c.excluded && !c.countsOnlyForOvervote).map((c) => c.id);

/** Rank position of each candidate on a ballot (first mention wins; same rank means no preference). */
function positions(ballot: BallotPattern, known: ReadonlySet<CandidateId>): Map<CandidateId, number> {
  const pos = new Map<CandidateId, number>();
  ballot.ranking.forEach((slot, rank) => {
    for (const id of slot) {
      if (id !== UNKNOWN_OVERVOTE_MARK && known.has(id) && !pos.has(id)) pos.set(id, rank);
    }
  });
  return pos;
}

export function pairwise(candidates: readonly Candidate[], ballots: readonly BallotPattern[]): PairwiseResult {
  const ids = contenders(candidates);
  const known = new Set(ids);
  const matrix = record<Record<CandidateId, number>>();
  for (const a of ids) {
    matrix[a] = record<number>();
    for (const b of ids) if (a !== b) matrix[a]![b] = 0;
  }
  for (const ballot of ballots) {
    const pos = positions(ballot, known);
    for (const [a, pa] of pos) {
      for (const b of ids) {
        if (a === b) continue;
        const pb = pos.get(b);
        if (pb === undefined || pa < pb) matrix[a]![b]! += ballot.count;
      }
    }
  }
  const beats = (a: CandidateId, b: CandidateId) => matrix[a]![b]! > matrix[b]![a]!;
  const find = (pred: (a: CandidateId, b: CandidateId) => boolean) =>
    ids.length > 1 ? (ids.find((a) => ids.every((b) => a === b || pred(a, b))) ?? null) : null;
  return {
    matrix,
    condorcetWinner: find(beats),
    condorcetLoser: find((a, b) => beats(b, a)),
  };
}

/** Most first choices; null on a tie or when nobody has any. */
export function pluralityWinner(candidates: readonly Candidate[], ballots: readonly BallotPattern[]): CandidateId | null {
  const known = new Set(contenders(candidates));
  const firsts = new Map<CandidateId, number>();
  for (const ballot of ballots) {
    const top = ballot.ranking.find((slot) => slot.length > 0);
    if (top?.length === 1 && known.has(top[0]!)) firsts.set(top[0]!, (firsts.get(top[0]!) ?? 0) + ballot.count);
  }
  let best: CandidateId | null = null;
  let bestVotes = 0;
  let tied = false;
  for (const [id, votes] of firsts) {
    if (votes > bestVotes) {
      best = id;
      bestVotes = votes;
      tied = false;
    } else if (votes === bestVotes) {
      tied = true;
    }
  }
  return tied ? null : best;
}
