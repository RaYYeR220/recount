import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { compareToGolden, type ElectionDataset, type Golden, presetRules, tabulate } from '@recount/engine';
import { DATASETS, type DatasetSpec } from './sources';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const GOLDENS = resolve(dirname(fileURLToPath(import.meta.url)), '../goldens');
const GZIP_OVER = 100 * 1024;

const { values } = parseArgs({
  options: {
    raw: { type: 'string', default: join(ROOT, 'data-raw') },
    out: { type: 'string', default: join(ROOT, 'apps/web/public/elections') },
    only: { type: 'string' },
    download: { type: 'boolean', default: false },
  },
});

const sha256 = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');

interface ManifestEntry {
  slug: string;
  title: string;
  file: string;
  bytes: number;
  sha256: string;
  ballots: number;
  patterns: number;
  presetId: string;
  source: ElectionDataset['source'];
  golden: { file: string; sha256: string } | null;
}

async function rawFile(spec: DatasetSpec): Promise<Buffer> {
  const path = join(values.raw!, spec.source.file);
  if (!existsSync(path)) {
    if (!values.download) throw new Error(`missing ${path}; rerun with --download or point --raw at a copy`);
    console.log(`  downloading ${spec.source.url}`);
    const res = await fetch(spec.source.url);
    if (!res.ok) throw new Error(`download failed: HTTP ${res.status} for ${spec.source.url}`);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  }
  return readFileSync(path);
}

function writeOutput(slug: string, json: string): { file: string; bytes: number; sha256: string } {
  const body = Buffer.from(json, 'utf8');
  const gz = body.length > GZIP_OVER;
  const file = gz ? `${slug}.json.gz` : `${slug}.json`;
  const data = gz ? gzipSync(body, { level: 9 }) : body;
  rmSync(join(values.out!, gz ? `${slug}.json` : `${slug}.json.gz`), { force: true });
  writeFileSync(join(values.out!, file), data);
  return { file, bytes: data.length, sha256: sha256(data) };
}

async function build(spec: DatasetSpec): Promise<ManifestEntry> {
  const started = Date.now();
  const raw = await rawFile(spec);
  const { parse, ...meta } = spec;
  const parsed = await parse(raw);
  const dataset: ElectionDataset = {
    ...meta,
    candidates: parsed.candidates,
    ballots: parsed.ballots,
    source: { ...spec.source, sha256: sha256(raw) },
  };
  const output = writeOutput(spec.slug, JSON.stringify(dataset));

  let golden: ManifestEntry['golden'] = null;
  const goldenPath = join(GOLDENS, `${spec.slug}.json`);
  if (existsSync(goldenPath)) {
    const text = readFileSync(goldenPath, 'utf8');
    writeFileSync(join(values.out!, 'goldens', `${spec.slug}.json`), text);
    golden = { file: `goldens/${spec.slug}.json`, sha256: sha256(text) };
    const result = tabulate({ candidates: dataset.candidates, ballots: dataset.ballots, rules: presetRules(spec.presetId, spec.seats) });
    const { cells, mismatches } = compareToGolden(result, dataset, JSON.parse(text) as Golden);
    console.log(`  golden: ${cells - mismatches.length}/${cells} cells match`);
    for (const m of mismatches.slice(0, 10)) console.log(`    round ${m.round} ${m.candidate}: report ${m.expected}, count ${m.actual}`);
  }

  const ballots = dataset.ballots.reduce((s, b) => s + b.count, 0);
  console.log(`  ${ballots} ballots, ${dataset.ballots.length} patterns -> ${output.file} (${output.bytes} bytes, ${((Date.now() - started) / 1000).toFixed(1)} s)`);
  return {
    slug: spec.slug,
    title: spec.title,
    ...output,
    ballots,
    patterns: dataset.ballots.length,
    presetId: spec.presetId,
    source: dataset.source,
    golden,
  };
}

async function main(): Promise<void> {
  const only = values.only?.split(',');
  const specs = only ? DATASETS.filter((d) => only.includes(d.slug)) : DATASETS;
  if (specs.length === 0) throw new Error(`no dataset matches --only ${values.only}`);
  mkdirSync(join(values.out!, 'goldens'), { recursive: true });

  const manifestPath = join(values.out!, 'manifest.json');
  const previous: ManifestEntry[] = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')).datasets : [];
  const entries = new Map(previous.map((e) => [e.slug, e]));
  for (const spec of specs) {
    console.log(spec.slug);
    entries.set(spec.slug, await build(spec));
  }
  const order = DATASETS.map((d) => d.slug);
  const datasets = [...entries.values()].sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug));
  writeFileSync(manifestPath, `${JSON.stringify({ version: 1, datasets }, null, 2)}\n`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
