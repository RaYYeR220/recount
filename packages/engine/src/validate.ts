import type { BallotPattern, Candidate, CandidateId } from './types';
import { UNKNOWN_OVERVOTE_MARK } from './types';

const RESERVED = new Set(['__proto__', 'constructor', 'prototype']);

/** Candidate ids become object keys in results, so a few names are off limits. */
export function assertCandidateId(id: unknown): asserts id is CandidateId {
  if (typeof id !== 'string' || id.length === 0) throw new TypeError('candidate id must be a non-empty string');
  if (RESERVED.has(id)) throw new TypeError(`candidate id ${JSON.stringify(id)} is reserved`);
}

export function validateInput(candidates: readonly Candidate[], ballots: readonly BallotPattern[]): void {
  const known = new Set<CandidateId>();
  for (const c of candidates) {
    assertCandidateId(c.id);
    if (known.has(c.id)) throw new TypeError(`duplicate candidate id ${JSON.stringify(c.id)}`);
    known.add(c.id);
  }
  for (const b of ballots) {
    if (!Number.isSafeInteger(b.count) || b.count <= 0) {
      throw new RangeError(`ballot count must be a positive integer, got ${b.count}`);
    }
    for (const slot of b.ranking) {
      for (const id of slot) {
        if (id !== UNKNOWN_OVERVOTE_MARK && !known.has(id)) {
          throw new TypeError(`ballot ranks unknown candidate ${JSON.stringify(id)}`);
        }
      }
    }
  }
}

/** An object with no prototype, safe to key by untrusted strings. */
export function record<V>(): Record<string, V> {
  return Object.create(null) as Record<string, V>;
}
