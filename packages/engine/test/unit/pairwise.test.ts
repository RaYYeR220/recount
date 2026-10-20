import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ElectionDataset } from '../../src/dataset';
import { pairwise, pluralityWinner } from '../../src/pairwise';
import { presetRules } from '../../src/presets';
import { tabulate } from '../../src/tabulate';
import { ballot, cands } from '../helpers';

const burlington = JSON.parse(
  readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '../../../../apps/web/public/elections/burlington-2009-mayor.json'),
    'utf8',
  ),
) as ElectionDataset;
const idOf = (name: string) => burlington.candidates.find((c) => c.name === name)!.id;

describe('pairwise', () => {
  // FairVote's copy of the ballots; the commonly quoted 4,067-3,477 and 4,597-3,668 come from
  // PrefLib's copy, which differs by a few ballots (see the Burlington replay).
  it('Burlington 2009: Montroll beats everyone head to head but IRV elects Kiss', () => {
    const { matrix, condorcetWinner } = pairwise(burlington.candidates, burlington.ballots);
    const [montroll, kiss, wright] = ['Andy Montroll', 'Bob Kiss', 'Kurt Wright'].map(idOf) as [string, string, string];
    expect([matrix[montroll]![kiss], matrix[kiss]![montroll]]).toEqual([4068, 3476]);
    expect([matrix[montroll]![wright], matrix[wright]![montroll]]).toEqual([4600, 3665]);
    expect([matrix[kiss]![wright], matrix[wright]![kiss]]).toEqual([4316, 4061]);
    expect(condorcetWinner).toBe(montroll);

    const irv = tabulate({ candidates: burlington.candidates, ballots: burlington.ballots, rules: presetRules('burlington-2009') });
    expect(irv.winners).toEqual([kiss]);
    expect(pluralityWinner(burlington.candidates, burlington.ballots)).toBe(wright);
  });

  it('finds a Condorcet loser and leaves ties without a winner', () => {
    const candidates = cands('a', 'b', 'c');
    const r = pairwise(candidates, [ballot(2, 'a', 'b', 'c'), ballot(1, 'b', 'a', 'c')]);
    expect(r.condorcetWinner).toBe('a');
    expect(r.condorcetLoser).toBe('c');
    const cycle = pairwise(candidates, [ballot(1, 'a', 'b', 'c'), ballot(1, 'b', 'c', 'a'), ballot(1, 'c', 'a', 'b')]);
    expect(cycle.condorcetWinner).toBeNull();
    expect(cycle.condorcetLoser).toBeNull();
  });

  it('counts a ranked candidate above an unranked one and ignores same-rank marks', () => {
    const r = pairwise(cands('a', 'b', 'c'), [ballot(3, 'a'), ballot(1, 'b|c')]);
    expect(r.matrix.a).toEqual({ b: 3, c: 3 });
    expect(r.matrix.b).toEqual({ a: 1, c: 0 });
  });

  it('plurality returns null on a first-choice tie', () => {
    expect(pluralityWinner(cands('a', 'b'), [ballot(2, 'a'), ballot(2, 'b')])).toBeNull();
  });
});
