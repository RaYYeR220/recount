import type { Fixed } from './fixed';
import { JavaRandom, javaShuffle } from './javaRandom';
import type { Rules } from './rules';
import type { Candidate, CandidateId } from './types';

export interface Tiebreaker {
  /** Picks the candidate to eliminate among those tied for last. */
  loser(tied: readonly CandidateId[], previousRound?: Readonly<Record<CandidateId, Fixed>>): CandidateId;
  /** Picks the candidate to elect among those tied for first. */
  winner(tied: readonly CandidateId[], previousRound?: Readonly<Record<CandidateId, Fixed>>): CandidateId;
}

const byCodeUnits = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Tiebreaks as documented for RCTab's tiebreakMode option. */
export function createTiebreaker(candidates: readonly Candidate[], rules: Rules): Tiebreaker {
  const names = new Map(candidates.map((c) => [c.id, c.name]));
  const nameOf = (id: CandidateId) => names.get(id) ?? id;
  const alphabetical = (ids: readonly CandidateId[]) => [...ids].sort((a, b) => byCodeUnits(nameOf(a), nameOf(b)));
  const rnd = new JavaRandom(BigInt(rules.randomSeed ?? '0'));

  const draw = (ids: readonly CandidateId[]) => {
    const sorted = alphabetical(ids);
    return sorted[Math.floor(rnd.nextDouble() * sorted.length)]!;
  };

  const ranked = (order: readonly CandidateId[]) => {
    const position = new Map(order.map((id, i) => [id, i]));
    const pos = (id: CandidateId) => position.get(id) ?? Number.MAX_SAFE_INTEGER;
    return {
      earliest: (ids: readonly CandidateId[]) => [...ids].sort((a, b) => pos(a) - pos(b))[0]!,
      latest: (ids: readonly CandidateId[]) => [...ids].sort((a, b) => pos(b) - pos(a))[0]!,
    };
  };

  switch (rules.tiebreakMode) {
    case 'useCandidateOrder': {
      const order = ranked(candidates.map((c) => c.id));
      return { loser: order.latest, winner: order.earliest };
    }
    case 'generatePermutation': {
      const permutation = javaShuffle(alphabetical(candidates.map((c) => c.id)), rnd);
      const order = ranked(permutation);
      return { loser: order.latest, winner: order.earliest };
    }
    case 'random':
      return { loser: draw, winner: draw };
    case 'previousRoundCountsThenRandom': {
      // RCTab draws from the generator even when the previous round already settles the
      // tie (tiebreak_previous_round_counts_then_random_test only passes that way).
      const narrow = (ids: readonly CandidateId[], prev: Readonly<Record<CandidateId, Fixed>> | undefined, pickMax: boolean) => {
        if (!prev) return ids;
        const votes = (id: CandidateId) => (Object.hasOwn(prev, id) ? prev[id]! : 0n);
        const target = ids.map(votes).reduce((m, v) => (pickMax ? (v > m ? v : m) : v < m ? v : m));
        return ids.filter((id) => votes(id) === target);
      };
      return {
        loser: (ids, prev) => draw(narrow(ids, prev, false)),
        winner: (ids, prev) => draw(narrow(ids, prev, true)),
      };
    }
  }
}
