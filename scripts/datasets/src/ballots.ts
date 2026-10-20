import { assertCandidateId, type BallotPattern, type Candidate, PatternCounter, UNKNOWN_OVERVOTE_MARK } from '@recount/engine';

/** Ballots spelled with candidate names, as read from a CVR. */
export interface NamedBallots {
  counter: PatternCounter;
  writeIns: Set<string>;
  /** Marks that make an overvote but are never votes, e.g. blank write-in lines. */
  marksOnly: Set<string>;
}

export function namedBallots(): NamedBallots {
  return { counter: new PatternCounter(), writeIns: new Set(), marksOnly: new Set() };
}

export interface Parsed {
  candidates: Candidate[];
  ballots: BallotPattern[];
}

/**
 * Gives candidates short ids (c1 = most first choices) and rewrites the ballots with them.
 * Write-ins and write-in-line marks are listed last.
 */
export function finalize({ counter, writeIns, marksOnly }: NamedBallots): Parsed {
  const named = counter.patterns();
  const first = new Map<string, number>();
  for (const { ranking, count } of named) {
    for (const slot of ranking) for (const name of slot) if (!first.has(name)) first.set(name, 0);
    const top = ranking.find((slot) => slot.length > 0);
    if (top?.length === 1) first.set(top[0]!, (first.get(top[0]!) ?? 0) + count);
  }
  first.delete(UNKNOWN_OVERVOTE_MARK);
  for (const name of [...writeIns, ...marksOnly]) if (!first.has(name)) first.set(name, 0);

  const group = (name: string) => (marksOnly.has(name) ? 2 : writeIns.has(name) ? 1 : 0);
  const names = [...first.keys()].sort(
    (a, b) => group(a) - group(b) || first.get(b)! - first.get(a)! || (a < b ? -1 : a > b ? 1 : 0),
  );
  const idOf = new Map(names.map((name, i) => [name, `c${i + 1}`]));
  const candidates: Candidate[] = names.map((name) => {
    assertCandidateId(name);
    return {
      id: idOf.get(name)!,
      name,
      ...(writeIns.has(name) ? { isWriteIn: true } : {}),
      ...(marksOnly.has(name) ? { countsOnlyForOvervote: true } : {}),
    };
  });

  const out = new PatternCounter();
  for (const { ranking, count } of named) {
    out.add(
      ranking.map((slot) => slot.map((name) => (name === UNKNOWN_OVERVOTE_MARK ? name : idOf.get(name)!))),
      count,
    );
  }
  return { candidates, ballots: out.patterns() };
}
