import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import type { ElectionDataset, Golden } from '../../src/dataset';
import { compareToGolden } from '../../src/golden';
import { presetRules } from '../../src/presets';
import { tabulate } from '../../src/tabulate';

const ELECTIONS = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../apps/web/public/elections');

/** Every number in the official report matches, cell by cell. */
const EXACT = [
  'nyc-2025-dem-mayor',
  'nyc-2026-council-d3',
  'minneapolis-2025-mayor',
  'minneapolis-2025-park-at-large',
  'minneapolis-2025-bet',
  'portland-2024-d1',
];

/** Replays that do not match the report exactly, with the mismatch count pinned. */
const KNOWN_DIVERGENT: Record<string, { mismatches: number; reason: string }> = {
  'burlington-2009-mayor': {
    mismatches: 2,
    reason: "FairVote's normalised ballots, not the city's file: one ballot the report gives Wright in round 3 exhausts here",
  },
  'alaska-2022-special': {
    mismatches: 3,
    reason: "FairVote's normalised ballots, not the Division's export; totals are within 18 votes of the transcribed report",
  },
};

function load(slug: string): { dataset: ElectionDataset; golden: Golden } {
  const gz = join(ELECTIONS, `${slug}.json.gz`);
  const text = existsSync(gz) ? gunzipSync(readFileSync(gz)).toString('utf8') : readFileSync(join(ELECTIONS, `${slug}.json`), 'utf8');
  return {
    dataset: JSON.parse(text) as ElectionDataset,
    golden: JSON.parse(readFileSync(join(ELECTIONS, 'goldens', `${slug}.json`), 'utf8')) as Golden,
  };
}

function replay(slug: string) {
  const { dataset, golden } = load(slug);
  const result = tabulate({
    candidates: dataset.candidates,
    ballots: dataset.ballots,
    rules: presetRules(dataset.presetId, dataset.seats),
  });
  return { dataset, golden, result, comparison: compareToGolden(result, dataset, golden) };
}

describe('certified replays', () => {
  for (const slug of EXACT) {
    it(`${slug} matches the official report in every cell`, () => {
      const { comparison } = replay(slug);
      expect(comparison.mismatches).toEqual([]);
      expect(comparison.cells).toBeGreaterThan(0);
    });
  }

  for (const [slug, { mismatches, reason }] of Object.entries(KNOWN_DIVERGENT)) {
    it(`${slug} differs in exactly ${mismatches} cells (${reason})`, () => {
      const { comparison, golden, result, dataset } = replay(slug);
      expect(comparison.mismatches).toHaveLength(mismatches);
      const winners = result.winners.map((id) => dataset.candidates.find((c) => c.id === id)!.name);
      expect(winners).toEqual(golden.winners);
    });
  }

  it('the NYC 2025 replay has the certified ballot count', () => {
    const { result } = replay('nyc-2025-dem-mayor');
    expect(result.totalBallots).toBe(1_114_433);
  });
});
