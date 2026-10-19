import type { Rules } from './rules';
import type { Candidate, CandidateId, Resolution, Slot } from './types';

/**
 * Finds where a ballot counts given the candidates still in the race.
 *
 * Ranks are read in order. A skipped rank only matters when a later rank is marked:
 * the gap since the previous marked rank is compared with maxSkippedRanksAllowed, so
 * trailing blanks leave the ballot exhausted rather than skipped-out. Marks for
 * eliminated, elected or excluded candidates are passed over.
 */
export function resolveChoice(
  ranking: readonly Slot[],
  continuing: ReadonlySet<CandidateId>,
  candidates: ReadonlyMap<CandidateId, Candidate>,
  rules: Rules,
): Resolution {
  const { maxRankingsAllowed, maxSkippedRanksAllowed, overvoteRule } = rules;
  const limit = maxRankingsAllowed === 'max' ? ranking.length : Math.min(ranking.length, maxRankingsAllowed);
  const seen = new Set<CandidateId>();
  let lastMarked = 0;
  let marked = false;

  for (let rank = 1; rank <= limit; rank++) {
    const slot = ranking[rank - 1]!;
    if (slot.length === 0) continue;
    marked = true;
    if (maxSkippedRanksAllowed !== 'unlimited' && rank - lastMarked - 1 > maxSkippedRanksAllowed) {
      return { kind: 'inactive', reason: 'skippedRankings' };
    }
    lastMarked = rank;

    if (slot.length > 1) {
      if (overvoteRule === 'exhaustImmediately') return { kind: 'inactive', reason: 'overvote' };
      if (overvoteRule === 'alwaysSkipToNextRank') continue;
      const live = slot.filter((id) => continuing.has(id) && !candidates.get(id)?.countsOnlyForOvervote);
      if (live.length > 1) return { kind: 'inactive', reason: 'overvote' };
      if (live.length === 1) return { kind: 'vote', candidate: live[0]! };
      continue;
    }

    const id = slot[0]!;
    if (candidates.get(id)?.countsOnlyForOvervote) continue;
    if (seen.has(id)) {
      if (rules.exhaustOnDuplicateCandidate) return { kind: 'inactive', reason: 'repeatedRankings' };
      continue;
    }
    seen.add(id);
    if (continuing.has(id)) return { kind: 'vote', candidate: id };
  }

  return marked ? { kind: 'inactive', reason: 'exhaustedChoices' } : { kind: 'undervote' };
}
