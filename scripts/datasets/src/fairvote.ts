import { type Slot, UNKNOWN_OVERVOTE } from '@recount/engine';
import { finalize, namedBallots, type Parsed } from './ballots';
import { parseCsv } from './csv';

/**
 * FairVote's normalised CVRs (Otis, Harvard Dataverse doi:10.7910/DVN/AMK8PJ): one row per
 * ballot, rank1..rankN columns holding names, "skipped", "overvote" or "Write-in".
 * With `excluded`, write-in marks are passed over like a candidate who never stood.
 */
export function parseFairVoteCvr(csv: string, writeIns: 'candidate' | 'excluded' = 'candidate', writeIn = 'Write-in'): Parsed {
  const out = namedBallots();
  out.writeIns.add(writeIn);
  let rankColumns: number[] | null = null;
  const slotOf = (v: string | undefined): Slot => {
    const s = (v ?? '').trim();
    if (s === '' || s === 'skipped') return [];
    if (s === 'overvote') return UNKNOWN_OVERVOTE;
    return [s];
  };
  parseCsv(csv, (fields) => {
    if (rankColumns === null) {
      rankColumns = fields.flatMap((h, i) => (/^rank\d+$/.test(h) ? [i] : []));
      if (rankColumns.length === 0) throw new Error('no rank columns in FairVote CVR');
      return;
    }
    if (fields.length === 1 && fields[0] === '') return;
    out.counter.add(rankColumns.map((i) => slotOf(fields[i])));
  });
  const parsed = finalize(out);
  if (writeIns === 'excluded') {
    parsed.candidates = parsed.candidates.map((c) => (c.name === writeIn ? { ...c, excluded: true } : c));
  }
  return parsed;
}
