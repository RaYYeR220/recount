import type { Slot } from '@recount/engine';
import { finalize, namedBallots, type Parsed } from './ballots';
import { parseCsv } from './csv';

const CHOICE = /^Choice_\d+_\d+:([^:]*):(\d+):[^:]*:(.*):[^:]*$/;

/**
 * Clear Ballot grid CVR (one 0/1 column per candidate and rank). Blank write-in lines
 * ("Write-in-120" ...) are marks that can overvote a rank but never count as a vote.
 */
export function parseClearBallotCvr(csv: string, contest: string, uncertifiedWriteIn: string): Parsed {
  const out = namedBallots();
  out.writeIns.add(uncertifiedWriteIn);
  let columns: Array<{ index: number; rank: number; name: string }> | null = null;
  let ranks = 0;

  parseCsv(csv, (fields) => {
    if (columns === null) {
      columns = fields.flatMap((h, index) => {
        const m = CHOICE.exec(h);
        return m && m[1] === contest ? [{ index, rank: Number(m[2]), name: m[3]! }] : [];
      });
      if (columns.length === 0) throw new Error(`no columns for contest ${JSON.stringify(contest)}`);
      ranks = Math.max(...columns.map((c) => c.rank));
      for (const c of columns) if (c.name.startsWith('Write-in')) out.marksOnly.add(c.name);
      return;
    }
    const ranking: string[][] = Array.from({ length: ranks }, () => []);
    let marked = false;
    for (const c of columns) {
      const v = fields[c.index];
      if (v === '1') {
        ranking[c.rank - 1]!.push(c.name);
        marked = true;
      } else if (v !== '0' && v !== '' && v !== undefined) {
        throw new Error(`unexpected grid value ${JSON.stringify(v)}`);
      }
    }
    if (marked) out.counter.add(ranking as Slot[]);
  });
  return finalize(out);
}
