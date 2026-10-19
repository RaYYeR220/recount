import { describe, expect, it } from 'vitest';
import { ballot, cands, count, expectConserved, fmt, tallies } from '../helpers';

describe('IRV', () => {
  it('majority in round 1 ends with one round', () => {
    const r = count(cands('a', 'b'), [ballot(3, 'a'), ballot(2, 'b')]);
    expect(r.rounds).toHaveLength(1);
    expect(r.winners).toEqual(['a']);
    expect(fmt(r, r.rounds[0]!.threshold)).toBe('3');
    expectConserved(r);
  });

  it('lowest eliminated and transfers follow next choice', () => {
    const r = count(cands('a', 'b', 'c'), [ballot(1, 'a'), ballot(1, 'a', 'c'), ballot(2, 'b'), ballot(1, 'c', 'b')]);
    expect(tallies(r)).toEqual([
      { a: '2', b: '2', c: '1' },
      { a: '2', b: '3' },
    ]);
    expect(r.rounds[0]!.eliminated).toEqual(['c']);
    expect(r.rounds[0]!.transfers).toEqual([{ from: 'c', to: { b: 10_000n } }]);
    expect(r.winners).toEqual(['b']);
    expectConserved(r);
  });

  it('batch elimination removes the largest group whose combined total < next candidate', () => {
    const r = count(
      cands('a', 'b', 'c', 'd', 'e'),
      [ballot(10, 'a'), ballot(7, 'b'), ballot(3, 'c', 'a'), ballot(2, 'd'), ballot(1, 'e')],
      { batchElimination: true },
    );
    expect(r.rounds[0]!.eliminated).toEqual(['c', 'd', 'e']);
    expect(tallies(r)[1]).toEqual({ a: '13', b: '7' });
    expect(r.rounds[1]!.inactive.exhaustedChoices).toBe(30_000n);
    expect(r.winners).toEqual(['a']);
    expectConserved(r);
  });

  it('batch rule comes first; the tiebreak only settles what the batch cannot separate', () => {
    const rules = { batchElimination: true, tiebreakMode: 'useCandidateOrder' } as const;
    const batched = count(cands('a', 'b', 'c', 'd'), [ballot(9, 'a'), ballot(8, 'b'), ballot(1, 'c'), ballot(1, 'd')], rules);
    expect(batched.rounds[0]!.eliminated).toEqual(['c', 'd']);
    const tied = count(cands('a', 'b', 'c', 'd'), [ballot(9, 'a'), ballot(8, 'b'), ballot(5, 'c'), ballot(5, 'd')], rules);
    expect(tied.rounds[0]!.eliminated).toEqual(['d']);
  });

  it('continueUntilTwoCandidatesRemain keeps counting after majority', () => {
    const ballots = [ballot(6, 'a'), ballot(3, 'b'), ballot(2, 'c', 'b')];
    const stop = count(cands('a', 'b', 'c'), ballots);
    expect(stop.rounds).toHaveLength(1);
    const go = count(cands('a', 'b', 'c'), ballots, { continueUntilTwoCandidatesRemain: true });
    expect(go.winners).toEqual(['a']);
    expect(go.rounds[0]!.elected).toEqual(['a']);
    expect(tallies(go)).toEqual([
      { a: '6', b: '3', c: '2' },
      { a: '6', b: '3', c: '2' },
      { a: '6', b: '5' },
    ]);
    expect(go.rounds.map((x) => fmt(go, x.threshold))).toEqual(['6', '6', '6']);
    expectConserved(go);
  });

  it('eliminateWriteInsFirst removes write-ins after round 1 regardless of total', () => {
    const candidates = [...cands('a', 'b'), { id: 'w', name: 'Write-in', isWriteIn: true }];
    const r = count(candidates, [ballot(5, 'a'), ballot(3, 'b'), ballot(4, 'w', 'b')], { eliminateWriteInsFirst: true });
    expect(r.rounds[0]!.eliminated).toEqual(['w']);
    expect(tallies(r)[1]).toEqual({ a: '5', b: '7' });
    expect(r.winners).toEqual(['b']);
  });

  it('previousRoundCountsThenRandom breaks a bottom tie by the earlier round', () => {
    const r = count(cands('a', 'b', 'c', 'd'), [ballot(5, 'a'), ballot(3, 'b'), ballot(2, 'c'), ballot(1, 'd', 'c')], {
      tiebreakMode: 'previousRoundCountsThenRandom',
      randomSeed: '7',
    });
    expect(tallies(r)[1]).toEqual({ a: '5', b: '3', c: '3' });
    expect(r.rounds[1]!.eliminated).toEqual(['c']);
  });

  it('useCandidateOrder picks the later candidate in list order to eliminate', () => {
    const r = count(cands('a', 'b', 'c'), [ballot(3, 'a'), ballot(2, 'b'), ballot(2, 'c')], {
      tiebreakMode: 'useCandidateOrder',
    });
    expect(r.rounds[0]!.eliminated).toEqual(['c']);
  });

  it('a two-way tie in the last round elects by tiebreak', () => {
    const r = count(cands('a', 'b'), [ballot(2, 'a'), ballot(2, 'b')], { tiebreakMode: 'useCandidateOrder' });
    expect(r.winners).toEqual(['a']);
    expect(r.rounds).toHaveLength(1);
  });

  it('a ballot overvoted or blank at rank 1 never counts for anyone', () => {
    const r = count(cands('a', 'b'), [ballot(2, 'a|b', 'a'), ballot(1, '', ''), ballot(1, 'b')], {
      overvoteRule: 'exhaustImmediately',
    });
    expect(tallies(r)[0]).toEqual({ a: '0', b: '1' });
    expect(r.rounds[0]!.inactive.overvotes).toBe(20_000n);
    expect(r.undervotes).toBe(1);
    expectConserved(r);
  });

  it('zero ballots → no winner, empty rounds, no throw', () => {
    const r = count(cands('a', 'b'), []);
    expect(r.rounds).toEqual([]);
    expect(r.winners).toEqual([]);
    expect(r.totalBallots).toBe(0);
  });

  it('single candidate elected in round 1', () => {
    const r = count(cands('a'), [ballot(4, 'a')]);
    expect(r.rounds).toHaveLength(1);
    expect(r.winners).toEqual(['a']);
  });

  it('only undervotes → no winner without dividing by zero', () => {
    const r = count(cands('a', 'b'), [ballot(3, '')]);
    expect(r.undervotes).toBe(3);
    expect(r.rounds).toHaveLength(1);
    expect(r.winners).toEqual([]);
    expectConserved(r);
  });

  it('excluded candidates never appear and their ballots move on', () => {
    const candidates = [{ id: 'x', name: 'x', excluded: true }, ...cands('a', 'b')];
    const r = count(candidates, [ballot(3, 'x', 'b'), ballot(2, 'a'), ballot(1, 'x')]);
    expect(tallies(r)[0]).toEqual({ a: '2', b: '3' });
    expect(r.rounds[0]!.inactive.exhaustedChoices).toBe(10_000n);
  });
});
