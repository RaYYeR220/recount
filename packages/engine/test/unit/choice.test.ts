import { describe, expect, it } from 'vitest';
import { resolveChoice } from '../../src/choice';
import { DEFAULT_RULES, type Rules } from '../../src/rules';
import type { Candidate, Slot } from '../../src/types';

const candidates = new Map<string, Candidate>(
  [
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' },
    { id: 'c', name: 'C' },
    { id: 'wi120', name: 'Write-in-120', countsOnlyForOvervote: true },
  ].map((c) => [c.id, c]),
);
const all = new Set(['a', 'b', 'c']);

function resolve(ranking: Slot[], rules: Partial<Rules> = {}, continuing: Set<string> = all) {
  return resolveChoice(ranking, continuing, candidates, { ...DEFAULT_RULES, ...rules });
}

describe('resolveChoice', () => {
  it('overvote exhausts under exhaustImmediately', () => {
    expect(resolve([['a', 'b'], ['c']], { overvoteRule: 'exhaustImmediately' })).toEqual({
      kind: 'inactive',
      reason: 'overvote',
    });
  });

  it('overvote skips under alwaysSkipToNextRank', () => {
    expect(resolve([['a', 'b'], ['c']], { overvoteRule: 'alwaysSkipToNextRank' })).toEqual({
      kind: 'vote',
      candidate: 'c',
    });
  });

  it('exhaustIfMultipleContinuing with one continuing', () => {
    const rules = { overvoteRule: 'exhaustIfMultipleContinuing' } as const;
    expect(resolve([['a', 'b']], rules, new Set(['a']))).toEqual({ kind: 'vote', candidate: 'a' });
    expect(resolve([['a', 'b'], ['c']], rules, new Set(['c']))).toEqual({ kind: 'vote', candidate: 'c' });
    expect(resolve([['a', 'b'], ['c']], rules)).toEqual({ kind: 'inactive', reason: 'overvote' });
  });

  it('two consecutive skips exhaust when maxSkippedRanksAllowed=1', () => {
    expect(resolve([[], [], ['a']], { maxSkippedRanksAllowed: 1 })).toEqual({
      kind: 'inactive',
      reason: 'skippedRankings',
    });
    expect(resolve([[], ['a']], { maxSkippedRanksAllowed: 1 })).toEqual({ kind: 'vote', candidate: 'a' });
  });

  it('skips allowed when unlimited', () => {
    expect(resolve([[], [], ['a']], { maxSkippedRanksAllowed: 'unlimited' })).toEqual({
      kind: 'vote',
      candidate: 'a',
    });
  });

  it('trailing skips never exhaust a ballot for skipped rankings', () => {
    expect(resolve([['a'], [], []], { maxSkippedRanksAllowed: 0 }, new Set(['b']))).toEqual({
      kind: 'inactive',
      reason: 'exhaustedChoices',
    });
  });

  it('duplicate exhausts when exhaustOnDuplicateCandidate', () => {
    expect(resolve([['a'], ['a'], ['b']], { exhaustOnDuplicateCandidate: true }, new Set(['b']))).toEqual({
      kind: 'inactive',
      reason: 'repeatedRankings',
    });
  });

  it('duplicate skipped otherwise', () => {
    expect(resolve([['a'], ['a'], ['b']], { exhaustOnDuplicateCandidate: false }, new Set(['b']))).toEqual({
      kind: 'vote',
      candidate: 'b',
    });
  });

  it('ranks past maxRankingsAllowed ignored', () => {
    expect(resolve([['a'], ['b']], { maxRankingsAllowed: 1 }, new Set(['b']))).toEqual({
      kind: 'inactive',
      reason: 'exhaustedChoices',
    });
    expect(resolve([['a'], ['b']], { maxRankingsAllowed: 'max' }, new Set(['b']))).toEqual({
      kind: 'vote',
      candidate: 'b',
    });
  });

  it('blank ballot is undervote', () => {
    expect(resolve([])).toEqual({ kind: 'undervote' });
    expect(resolve([[], [], []])).toEqual({ kind: 'undervote' });
  });

  it('countsOnlyForOvervote mark makes [[wi120, a]] an overvote but [[wi120]] never a vote', () => {
    expect(resolve([['wi120', 'a'], ['b']], { overvoteRule: 'exhaustImmediately' })).toEqual({
      kind: 'inactive',
      reason: 'overvote',
    });
    expect(resolve([['wi120', 'a'], ['b']], { overvoteRule: 'alwaysSkipToNextRank' })).toEqual({
      kind: 'vote',
      candidate: 'b',
    });
    expect(resolve([['wi120']])).toEqual({ kind: 'inactive', reason: 'exhaustedChoices' });
    expect(resolve([['wi120'], ['c']])).toEqual({ kind: 'vote', candidate: 'c' });
  });

  it('all choices eliminated → exhaustedChoices', () => {
    expect(resolve([['a'], ['b']], {}, new Set(['c']))).toEqual({ kind: 'inactive', reason: 'exhaustedChoices' });
  });

  it('a skipped first rank counts against the skip allowance', () => {
    expect(resolve([[], ['a']], { maxSkippedRanksAllowed: 0 })).toEqual({
      kind: 'inactive',
      reason: 'skippedRankings',
    });
  });
});
