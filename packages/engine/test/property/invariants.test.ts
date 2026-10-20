import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { RoundResult, TabulationResult } from '../../src/result';
import { DEFAULT_RULES, type Rules } from '../../src/rules';
import { tabulate } from '../../src/tabulate';
import type { BallotPattern, Candidate, Slot } from '../../src/types';
import { expectConserved } from '../helpers';

const RUNS = { numRuns: Number(process.env.RUNS ?? 200) };
const IDS = ['a', 'b', 'c', 'd', 'e', 'f'];

interface Contest {
  candidates: Candidate[];
  ballots: BallotPattern[];
  rules: Rules;
}

const slot = (ids: string[]): fc.Arbitrary<Slot> =>
  fc.oneof(
    { weight: 1, arbitrary: fc.constant([] as string[]) },
    { weight: 6, arbitrary: fc.constantFrom(...ids).map((id) => [id]) },
    ...(ids.length > 1 ? [{ weight: 1, arbitrary: fc.shuffledSubarray(ids, { minLength: 2, maxLength: 2 }) }] : []),
  );

const ballots = (ids: string[]) =>
  fc.array(
    fc.record({
      ranking: fc.array(slot(ids), { maxLength: 5 }),
      count: fc.integer({ min: 1, max: 25 }),
    }),
    { maxLength: 25 },
  );

const commonRules = {
  overvoteRule: fc.constantFrom('exhaustImmediately', 'alwaysSkipToNextRank', 'exhaustIfMultipleContinuing'),
  maxSkippedRanksAllowed: fc.constantFrom<Rules['maxSkippedRanksAllowed']>('unlimited', 0, 1, 2),
  maxRankingsAllowed: fc.constantFrom<Rules['maxRankingsAllowed']>('max', 1, 2, 3, 5),
  exhaustOnDuplicateCandidate: fc.boolean(),
  tiebreakMode: fc.constantFrom('useCandidateOrder', 'random', 'previousRoundCountsThenRandom', 'generatePermutation'),
  randomSeed: fc.integer({ min: -1000, max: 1000 }).map(String),
  decimalPlacesForVoteArithmetic: fc.integer({ min: 1, max: 6 }),
  eliminateWriteInsFirst: fc.boolean(),
} as const;

const irvRules = fc.record({
  ...commonRules,
  batchElimination: fc.boolean(),
  continueUntilTwoCandidatesRemain: fc.boolean(),
  firstRoundDeterminesThreshold: fc.boolean(),
});

const stvRules = fc.record({
  ...commonRules,
  numberOfWinners: fc.integer({ min: 2, max: 4 }),
  winnerElectionMode: fc.constantFrom('multiWinnerAllowOnlyOneWinnerPerRound', 'multiWinnerAllowMultipleWinnersPerRound'),
  nonIntegerWinningThreshold: fc.boolean(),
  hareQuota: fc.boolean(),
  deferSurplus: fc.boolean(),
});

const contest = (rules: fc.Arbitrary<Partial<Rules>>): fc.Arbitrary<Contest> =>
  fc.integer({ min: 1, max: IDS.length }).chain((n) => {
    const ids = IDS.slice(0, n);
    return fc.record({
      candidates: fc.constant(ids.map((id, i): Candidate => ({ id, name: id.toUpperCase(), ...(i === n - 1 && n > 2 ? { isWriteIn: true } : {}) }))),
      ballots: ballots(ids),
      rules: rules.map((r) => ({ ...DEFAULT_RULES, ...r })),
    });
  });

const anyContest = fc.oneof(contest(irvRules), contest(stvRules));
const run = (c: Contest) => tabulate(c);

function eliminatedTransfers(r: RoundResult) {
  return r.eliminated.map((id) => ({
    id,
    held: r.tally[id]!,
    moved: Object.values(r.transfers.find((t) => t.from === id)?.to ?? {}).reduce((s, v) => s + v, 0n),
  }));
}

const winnersOf = (r: TabulationResult) => [...r.winners].sort();

describe('tabulation invariants', () => {
  it('every ballot is accounted for in every round', () => {
    fc.assert(fc.property(anyContest, (c) => expectConserved(run(c))), RUNS);
  });

  it('renaming candidate ids changes nothing but the ids', () => {
    fc.assert(
      fc.property(anyContest, (c) => {
        const rename = (id: string) => `x-${id}`;
        const renamed: Contest = {
          rules: c.rules,
          candidates: c.candidates.map((cand) => ({ ...cand, id: rename(cand.id) })),
          ballots: c.ballots.map((b) => ({ ...b, ranking: b.ranking.map((s) => s.map(rename)) })),
        };
        expect(run(renamed).winners).toEqual(run(c).winners.map(rename));
      }),
      RUNS,
    );
  });

  it('listing candidates in another order keeps the winners unless candidate order breaks ties', () => {
    fc.assert(
      fc.property(
        anyContest.filter((c) => c.rules.tiebreakMode !== 'useCandidateOrder'),
        (c) => {
          const reversed = { ...c, candidates: [...c.candidates].reverse() };
          expect(winnersOf(run(reversed))).toEqual(winnersOf(run(c)));
        },
      ),
      RUNS,
    );
  });

  it('doubling every ballot keeps the IRV winners', () => {
    fc.assert(
      fc.property(contest(irvRules), (c) => {
        const doubled = { ...c, ballots: c.ballots.map((b) => ({ ...b, count: b.count * 2 })) };
        expect(run(doubled).winners).toEqual(run(c).winners);
      }),
      RUNS,
    );
  });

  it('a candidate ranked first on more than half the ballots wins in round 1', () => {
    const majority = contest(irvRules).chain((c) =>
      fc.integer({ min: 1, max: 50 }).map((extra) => {
        const others = c.ballots.reduce((s, b) => s + b.count, 0);
        const ballots = [...c.ballots, { ranking: [['a']], count: others + extra }];
        return { ...c, candidates: c.candidates.map(({ isWriteIn: _, ...rest }) => rest), ballots };
      }),
    );
    fc.assert(
      fc.property(majority, (c) => {
        const r = run(c);
        expect(r.winners).toEqual(['a']);
        expect(r.rounds[0]!.elected).toEqual(['a']);
      }),
      RUNS,
    );
  });

  it('nobody is both elected and eliminated, and nobody is elected twice', () => {
    fc.assert(
      fc.property(anyContest, (c) => {
        const r = run(c);
        const elected = r.rounds.flatMap((x) => x.elected);
        const eliminated = new Set(r.rounds.flatMap((x) => x.eliminated));
        expect(new Set(elected).size).toBe(elected.length);
        for (const id of elected) expect(eliminated.has(id)).toBe(false);
        expect(r.winners.length).toBeLessThanOrEqual(c.rules.numberOfWinners);
      }),
      RUNS,
    );
  });

  it("everything an eliminated candidate held is transferred", () => {
    fc.assert(
      fc.property(anyContest, (c) => {
        for (const round of run(c).rounds) {
          for (const { held, moved } of eliminatedTransfers(round)) expect(moved).toBe(held);
        }
      }),
      RUNS,
    );
  });
});
