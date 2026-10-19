import type { BallotPattern, Candidate, CandidateId, Slot } from '../types';

/** Looks candidates up by name or alias, the way CVR files refer to them. */
export function nameIndex(candidates: readonly Candidate[]): Map<string, CandidateId> {
  const index = new Map<string, CandidateId>();
  for (const c of candidates) {
    index.set(c.name, c.id);
    for (const alias of c.aliases ?? []) index.set(alias, c.id);
  }
  return index;
}

/** Collapses identical rankings into weighted patterns, keeping first-seen order. */
export class PatternCounter {
  private readonly counts = new Map<string, { ranking: Slot[]; count: number }>();

  add(ranking: Slot[], count = 1): void {
    while (ranking.length > 0 && ranking[ranking.length - 1]!.length === 0) ranking.pop();
    const key = JSON.stringify(ranking);
    const cur = this.counts.get(key);
    if (cur) cur.count += count;
    else this.counts.set(key, { ranking, count });
  }

  patterns(): BallotPattern[] {
    return Array.from(this.counts.values());
  }
}
