import { describe, expect, it } from 'vitest';
import { parseCdfCvr } from '../../src/cvr/cdf';
import { cands } from '../helpers';

const candidates = cands('Alice', 'Bob');

function report(cvrs: unknown[]) {
  return {
    Election: [
      {
        Candidate: [
          { '@id': 'c-a', Name: 'Alice' },
          { '@id': 'c-b', Name: 'Bob' },
        ],
        Contest: [
          {
            '@id': 'k1',
            Name: 'Mayor',
            ContestSelection: [
              { '@id': 's-a', CandidateIds: ['c-a'] },
              { '@id': 's-b', CandidateIds: ['c-b'] },
            ],
          },
        ],
      },
    ],
    CVR: cvrs,
  };
}

const snapshot = (id: string, first: string) => ({
  '@id': id,
  CVRContest: [
    {
      ContestId: 'k1',
      CVRContestSelection: [{ ContestSelectionId: first, SelectionPosition: [{ Rank: 1, HasIndication: 'yes' }] }],
    },
  ],
});

describe('parseCdfCvr', () => {
  it('reads the snapshot CurrentSnapshotId points at', () => {
    const json = report([{ CurrentSnapshotId: 'b', CVRSnapshot: [snapshot('a', 's-a'), snapshot('b', 's-b')] }]);
    expect(parseCdfCvr(json, candidates, { contestId: 'Mayor' })).toEqual([{ ranking: [['Bob']], count: 1 }]);
  });

  it('fails when CurrentSnapshotId matches no snapshot', () => {
    const json = report([{ CurrentSnapshotId: 'zzz', CVRSnapshot: [snapshot('a', 's-a')] }]);
    expect(() => parseCdfCvr(json, candidates, { contestId: 'Mayor' })).toThrow(/matches no snapshot/);
  });

  it('uses a lone snapshot when CurrentSnapshotId is absent', () => {
    const json = report([{ CVRSnapshot: [snapshot('a', 's-a')] }]);
    expect(parseCdfCvr(json, candidates, { contestId: 'k1' })).toEqual([{ ranking: [['Alice']], count: 1 }]);
  });

  it('fails when several snapshots exist and none is marked current', () => {
    const json = report([{ CVRSnapshot: [snapshot('a', 's-a'), snapshot('b', 's-b')] }]);
    expect(() => parseCdfCvr(json, candidates, { contestId: 'k1' })).toThrow(/no CurrentSnapshotId/);
  });

  it('fails on an unknown contest, selection or rank', () => {
    expect(() => parseCdfCvr(report([]), candidates, { contestId: 'Council' })).toThrow(/not found/);
    const badSelection = report([{ CVRSnapshot: [snapshot('a', 's-x')] }]);
    expect(() => parseCdfCvr(badSelection, candidates)).toThrow(/unknown contest selection/);
    const badRank = report([{ CVRSnapshot: [snapshot('a', 's-a')] }]) as { CVR: Array<{ CVRSnapshot: unknown[] }> };
    (badRank.CVR[0]!.CVRSnapshot[0] as ReturnType<typeof snapshot>).CVRContest[0]!.CVRContestSelection[0]!.SelectionPosition[0]!.Rank = 0;
    expect(() => parseCdfCvr(badRank, candidates)).toThrow(/invalid rank/);
  });
});
