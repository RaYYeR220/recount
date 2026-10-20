import { type Slot, UNKNOWN_OVERVOTE } from '@recount/engine';
import { finalize, namedBallots, type Parsed } from './ballots';
import { xlsxRows } from './xlsx';
import { readEntry, zipEntries } from './zip';

const WRITE_INS = 'Write-ins';

/**
 * NYC Board of Elections CVR export: a zip of ES&S spreadsheets, one row per ballot and one
 * column per (contest, choice), cells holding candidacy ids, plus a CandidacyID_To_Name sheet.
 * `contest` is the start of the contest's column headers, e.g. "DEM Mayor Choice".
 */
export async function parseNycCvr(zip: Buffer, contest: string): Promise<Parsed> {
  const entries = zipEntries(zip).filter((e) => e.name.endsWith('.xlsx'));
  const nameEntry = entries.find((e) => e.name.includes('CandidacyID_To_Name'));
  if (!nameEntry) throw new Error('NYC CVR zip has no CandidacyID_To_Name sheet');

  const names = new Map<string, string>();
  for await (const row of xlsxRows(readEntry(zip, nameEntry))) {
    const [id, name] = row.cells;
    if (row.index > 1 && id && name) names.set(id.trim(), name.trim());
  }

  const out = namedBallots();
  out.writeIns.add(WRITE_INS);
  const slotOf = (cell: string | null | undefined): Slot => {
    const v = (cell ?? '').trim();
    if (v === '' || v === 'undervote') return [];
    if (v === 'overvote') return UNKNOWN_OVERVOTE;
    if (v === 'Write-in') return [WRITE_INS];
    const name = names.get(v);
    if (name === undefined) throw new Error(`unknown candidacy id ${JSON.stringify(v)}`);
    return [name];
  };

  for (const entry of entries.filter((e) => e !== nameEntry).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    let columns: number[] | null = null;
    for await (const row of xlsxRows(readEntry(zip, entry))) {
      if (columns === null) {
        columns = row.cells.flatMap((h, i) => (h?.startsWith(contest) ? [i] : []));
        if (columns.length === 0) throw new Error(`${entry.name}: no columns for ${contest}`);
        continue;
      }
      const cells = columns.map((i) => row.cells[i]);
      if (cells.every((c) => c === null || c === undefined || c.trim() === '')) continue;
      out.counter.add(cells.map(slotOf));
    }
  }
  return finalize(out);
}
