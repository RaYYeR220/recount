import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { parseEssRows } from '../../src/cvr/ess';
import { loadRctabConfig } from '../../src/rctabConfig';
import { readXlsxRows } from './xlsx';

/**
 * Stores a large ES&S fixture CVR as gzipped ballot patterns so the repository does not
 * carry the spreadsheet. Usage: tsx test/rctab/packCvr.ts <config.json>
 */
const configPath = resolve(process.argv[2]!);
const contest = loadRctabConfig(JSON.parse(readFileSync(configPath, 'utf8')));
for (const source of contest.sources) {
  const xlsx = resolve(dirname(configPath), source.filePath);
  const ballots = parseEssRows(readXlsxRows(xlsx), source.ess!, contest.candidates);
  const sha256 = createHash('sha256').update(readFileSync(xlsx)).digest('hex');
  const out = xlsx.replace(/\.xlsx$/, '.patterns.json.gz');
  writeFileSync(out, gzipSync(JSON.stringify({ source: basename(xlsx), sha256, ballots })));
  console.log(`${basename(out)}: ${ballots.length} patterns`);
}
