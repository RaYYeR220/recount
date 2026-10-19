import { describe, expect, it } from 'vitest';
import { ballot, cands, count } from '../helpers';

describe('input validation', () => {
  it.each(['__proto__', 'constructor', 'prototype', ''])('rejects the candidate id %j', (id) => {
    expect(() => count([...cands('a'), { id, name: 'x' }], [ballot(1, 'a')])).toThrow(TypeError);
  });

  it('rejects duplicate candidate ids', () => {
    expect(() => count(cands('a', 'a'), [ballot(1, 'a')])).toThrow(/duplicate/);
  });

  it('rejects ballots that rank an unknown candidate', () => {
    expect(() => count(cands('a'), [ballot(1, 'toString')])).toThrow(/unknown candidate/);
  });

  it('rejects non-integer ballot counts', () => {
    expect(() => count(cands('a'), [ballot(1.5, 'a')])).toThrow(RangeError);
  });

  it('returns prototype-free records keyed by candidate', () => {
    const r = count(cands('a', 'b', 'c'), [ballot(3, 'a'), ballot(2, 'b'), ballot(1, 'c', 'b')]);
    const round = r.rounds[0]!;
    expect(Object.getPrototypeOf(round.tally)).toBeNull();
    expect(Object.getPrototypeOf(round.transfers[0]!.to)).toBeNull();
    expect(Object.getPrototypeOf(round.fractional.transfers)).toBeNull();
    expect('toString' in round.tally).toBe(false);
  });
});
