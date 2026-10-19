import { readFileSync } from 'node:fs';
import { strFromU8, unzipSync } from 'fflate';
import { parseSharedStrings, parseSheet, type SheetRow } from '../../src/cvr/xlsx';

/** First worksheet of an .xlsx file. */
export function readXlsxRows(path: string): SheetRow[] {
  const files = unzipSync(readFileSync(path));
  const shared = files['xl/sharedStrings.xml'] ? parseSharedStrings(strFromU8(files['xl/sharedStrings.xml'])) : [];
  const sheet = Object.keys(files)
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort((a, b) => Number(/\d+/.exec(a)![0]) - Number(/\d+/.exec(b)![0]))[0];
  if (!sheet) throw new Error(`no worksheet in ${path}`);
  return parseSheet(strFromU8(files[sheet]!), shared);
}
