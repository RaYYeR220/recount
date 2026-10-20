import { type Slot, UNKNOWN_OVERVOTE } from '@recount/engine';
import { finalize, namedBallots, type Parsed } from './ballots';
import { parseCsv } from './csv';

const UWI = 'Undeclared Write-ins';

/**
 * Minneapolis publishes pre-aggregated CVRs: Precinct, 1st/2nd/3rd choice, Count, with
 * "undervote", "overvote" and "UWI" as cell values.
 */
export function parseMinneapolisCvr(csv: string): Parsed {
  const out = namedBallots();
  out.writeIns.add(UWI);
  const slotOf = (v: string): Slot => {
    const s = v.trim();
    if (s === '' || s === 'undervote') return [];
    if (s === 'overvote') return UNKNOWN_OVERVOTE;
    if (s === 'UWI') return [UWI];
    return [s];
  };

  let header: string[] | null = null;
  parseCsv(csv, (fields) => {
    if (header === null) {
      header = fields;
      if (header[0] !== 'Precinct' || header[header.length - 1] !== 'Count') throw new Error('unexpected Minneapolis CVR header');
      return;
    }
    if (fields.length === 1 && fields[0] === '') return;
    const count = Number(fields[fields.length - 1]);
    if (!Number.isSafeInteger(count) || count <= 0) throw new Error(`bad count in row ${JSON.stringify(fields)}`);
    out.counter.add(fields.slice(1, -1).map(slotOf), count);
  });
  return finalize(out);
}
