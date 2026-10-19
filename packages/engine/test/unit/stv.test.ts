import { describe, expect, it } from 'vitest';
import { formatFixed, fromInt } from '../../src/fixed';
import { DEFAULT_RULES, type Rules } from '../../src/rules';
import { computeThreshold } from '../../src/threshold';
import { ballot, cands, count, expectConserved, fmt, tallies } from '../helpers';

const stv = (seats: number, extra: Partial<Rules> = {}): Partial<Rules> => ({
  numberOfWinners: seats,
  winnerElectionMode: 'multiWinnerAllowMultipleWinnersPerRound',
  tiebreakMode: 'useCandidateOrder',
  ...extra,
});

const threshold = (votes: number, rules: Partial<Rules>) =>
  formatFixed(computeThreshold(fromInt(votes, 4), { ...DEFAULT_RULES, ...rules }).value, 4);

describe('STV thresholds', () => {
  it('Droop threshold floor(V/(S+1))+1', () => {
    expect(threshold(29, stv(3))).toBe('8');
    expect(threshold(113_348, stv(3))).toBe('28338');
  });

  it('nonIntegerWinningThreshold gives V/(S+1)+10^-dp', () => {
    expect(threshold(29, stv(3, { nonIntegerWinningThreshold: true }))).toBe('7.2501');
  });

  it('hareQuota gives V/S', () => {
    expect(threshold(59_463, stv(3, { hareQuota: true }))).toBe('19821');
  });

  it('single seat is a majority of active votes', () => {
    expect(threshold(14, {})).toBe('8');
    expect(threshold(13, {})).toBe('7');
  });
});

describe('STV', () => {
  const candidates = cands('a', 'b', 'c', 'd');
  const ballots = [ballot(7, 'a', 'b'), ballot(2, 'a', 'c'), ballot(3, 'b'), ballot(4, 'c'), ballot(4, 'd', 'c')];

  it('surplus transfers at truncated fraction', () => {
    const r = count(candidates, ballots, stv(3));
    expect(fmt(r, r.rounds[0]!.threshold)).toBe('6');
    expect(r.rounds[0]!.elected).toEqual(['a']);
    expect(r.rounds[0]!.transfers).toEqual([
      { from: 'a', to: { b: 23_331n, c: 6_666n, residualSurplus: 3n } },
    ]);
    expect(tallies(r)).toEqual([
      { a: '9', b: '3', c: '4', d: '4' },
      { a: '6', b: '5.3331', c: '4.6666', d: '4' },
      { a: '6', b: '5.3331', c: '8.6666' },
      { a: '6', b: '5.3331', c: '6' },
    ]);
    expect(r.rounds[1]!.eliminated).toEqual(['d']);
    expect(r.rounds[2]!.elected).toEqual(['b', 'c']);
    expect(fmt(r, r.rounds[3]!.finalRoundSurplus!)).toBe('2.6658');
    expect(fmt(r, r.rounds[3]!.residualSurplus)).toBe('0.0011');
    expect(r.winners).toEqual(['a', 'b', 'c']);
    expect(r.rounds[3]!.fractional.tally).toEqual(['b']);
    expectConserved(r);
  });

  it('allowOnlyOneWinnerPerRound elects the largest, defers the other', () => {
    const r = count(cands('a', 'b', 'c'), [ballot(5, 'a', 'c'), ballot(4, 'b'), ballot(1, 'c')], {
      ...stv(2),
      winnerElectionMode: 'multiWinnerAllowOnlyOneWinnerPerRound',
    });
    expect(fmt(r, r.rounds[0]!.threshold)).toBe('4');
    expect(r.rounds[0]!.elected).toEqual(['a']);
    expect(r.rounds[1]!.elected).toEqual(['b']);
    expect(tallies(r)[1]).toEqual({ a: '4', b: '4', c: '2' });
    expectConserved(r);
  });

  it('allowOnlyOneWinnerPerRound settles an exact tie at the top by tiebreak', () => {
    const r = count(cands('a', 'b', 'c'), [ballot(4, 'b', 'c'), ballot(4, 'a', 'c'), ballot(1, 'c')], {
      ...stv(2),
      winnerElectionMode: 'multiWinnerAllowOnlyOneWinnerPerRound',
    });
    expect(r.rounds[0]!.elected).toEqual(['a']);
  });

  it('deferSurplus (Minneapolis) defeats batch-eligible losers before moving a surplus that cannot change the order', () => {
    const ballots = [ballot(9, 'a', 'c'), ballot(6, 'b'), ballot(4, 'c'), ballot(1, 'd', 'b')];
    const mpls = count(cands('a', 'b', 'c', 'd'), ballots, stv(2, { deferSurplus: true }));
    expect(fmt(mpls, mpls.rounds[0]!.threshold)).toBe('7');
    expect(mpls.rounds[0]!.eliminated).toEqual(['d']);
    expect(mpls.rounds[0]!.elected).toEqual([]);
    expect(tallies(mpls)[1]).toEqual({ a: '9', b: '7', c: '4' });
    expect(mpls.rounds[1]!.elected).toEqual(['a', 'b']);
    expect(mpls.rounds).toHaveLength(2);

    const rctab = count(cands('a', 'b', 'c', 'd'), ballots, stv(2));
    expect(rctab.rounds[0]!.elected).toEqual(['a']);
    expect(rctab.winners).toEqual(['a', 'b']);
  });

  it('deferSurplus keeps what stays with a winner instead of capping it at the threshold', () => {
    const r = count(cands('a', 'b', 'c'), [ballot(9, 'a', 'b'), ballot(5, 'b'), ballot(5, 'c')], stv(2, { deferSurplus: true }));
    expect(r.rounds[0]!.elected).toEqual(['a']);
    expect(tallies(r)[1]).toEqual({ a: '7.0002', b: '6.9998', c: '5' });
    expectConserved(r);
  });

  it('more winners than candidates elects all', () => {
    const r = count(cands('a', 'b'), [ballot(2, 'a'), ballot(1, 'b')], stv(3));
    expect(r.rounds).toHaveLength(1);
    expect(r.winners).toEqual(['a', 'b']);
    expect(r.rounds[0]!.finalRoundSurplus).toBe(0n);
  });

  it('a write-in-line mark never receives a vote but still makes an overvote', () => {
    const candidates = [...cands('a', 'b'), { id: 'wi', name: 'Write-in-120', countsOnlyForOvervote: true }];
    const r = count(candidates, [ballot(3, 'wi|a', 'b'), ballot(2, 'wi'), ballot(1, 'a')], stv(1, {
      winnerElectionMode: 'singleWinnerMajority',
    }));
    expect(tallies(r)[0]).toEqual({ a: '1', b: '3' });
    expect('wi' in r.rounds[0]!.tally).toBe(false);
  });
});
