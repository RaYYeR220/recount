import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { parseCdfCvr } from '../../src/cvr/cdf';
import { parseEssRows } from '../../src/cvr/ess';
import { toRctabSummary } from '../../src/rctab';
import { loadRctabConfig } from '../../src/rctabConfig';
import { tabulate } from '../../src/tabulate';
import type { RctabSource } from '../../src/rctabConfig';
import type { BallotPattern, Candidate } from '../../src/types';
import { readXlsxRows } from './xlsx';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

/** Fixtures we knowingly do not reproduce yet, with the reason. Each must still fail. */
const KNOWN_DIVERGENT: Record<string, string> = {};

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));

function withoutGeneratedBy(report: unknown): unknown {
  const copy = structuredClone(report) as { config?: Record<string, unknown> };
  delete copy.config?.generatedBy;
  delete copy.config?.GeneratedDate;
  return JSON.parse(JSON.stringify(copy));
}

function loadBallots(dir: string, source: RctabSource, candidates: Candidate[]): BallotPattern[] {
  const path = resolve(dir, source.filePath);
  if (source.provider === 'cdf') return parseCdfCvr(readJson(path), candidates, { contestId: source.contestId });
  if (existsSync(path)) return parseEssRows(readXlsxRows(path), source.ess!, candidates);
  // Large spreadsheets are kept as patterns written by packCvr.ts.
  const packed = JSON.parse(gunzipSync(readFileSync(path.replace(/\.xlsx$/, '.patterns.json.gz'))).toString('utf8'));
  return packed.ballots as BallotPattern[];
}

function runFixture(stem: string): { actual: unknown; expected: unknown } {
  const dir = join(FIXTURES, stem);
  const contest = loadRctabConfig(readJson(join(dir, `${stem}_config.json`)));
  const ballots = contest.sources.flatMap((source) => loadBallots(dir, source, contest.candidates));
  const result = tabulate({ candidates: contest.candidates, ballots, rules: contest.rules });
  return {
    actual: withoutGeneratedBy(toRctabSummary(result, contest.meta)),
    expected: withoutGeneratedBy(readJson(join(dir, `${stem}_expected_detailed_report.json`))),
  };
}

const stems = readdirSync(FIXTURES)
  .filter((d) => !d.startsWith('_') && statSync(join(FIXTURES, d)).isDirectory())
  .sort();

describe('RCTab rules fixtures', () => {
  it('has fixtures to run', () => {
    expect(stems.length).toBeGreaterThanOrEqual(20);
  });

  for (const stem of stems) {
    const reason = KNOWN_DIVERGENT[stem];
    if (reason) {
      it(`${stem} (known divergent: ${reason})`, () => {
        const { actual, expected } = runFixture(stem);
        expect(actual).not.toEqual(expected);
      });
    } else {
      it(stem, () => {
        const { actual, expected } = runFixture(stem);
        expect(actual).toEqual(expected);
      });
    }
  }
});
