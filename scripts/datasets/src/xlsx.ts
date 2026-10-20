import { parseSharedStrings, type SheetRow, SheetRowReader } from '@recount/engine';
import { findEntry, readEntry, streamEntryText, zipEntries } from './zip';

/** Streams the rows of an .xlsx workbook's first worksheet. */
export async function* xlsxRows(file: Buffer): AsyncGenerator<SheetRow> {
  const entries = zipEntries(file);
  const sharedEntry = entries.find((e) => e.name === 'xl/sharedStrings.xml');
  const shared = sharedEntry ? parseSharedStrings(readEntry(file, sharedEntry).toString('utf8')) : [];
  const sheet = findEntry(entries, 'xl/worksheets/sheet1.xml');
  const reader = new SheetRowReader(shared);
  for await (const chunk of streamEntryText(file, sheet)) yield* reader.push(chunk);
}
