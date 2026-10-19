import { describe, expect, it } from 'vitest';
import { parseSharedStrings, parseSheet, SheetRowReader } from '../../src/cvr/xlsx';

const shared = parseSharedStrings(
  '<sst><si><t>Choice 1</t></si><si><r><t>Kiss, </t></r><r><t xml:space="preserve">Bob &amp; Co</t></r></si><si/></sst>',
);

const sheet =
  '<worksheet><sheetData>' +
  '<row r="1"><c r="A1" t="s"><v>0</v></c></row>' +
  '<row r="2" spans="1:4"><c r="A2"><v>12</v></c><c r="C2" t="s"><v>1</v></c><c r="D2" s="3"/></row>' +
  '<row r="4"/>' +
  '<row r="5"><c r="B5" t="inlineStr"><is><t>&#233;lan</t></is></c><c r="AA5" t="str"><v>x</v></c></row>' +
  '</sheetData></worksheet>';

describe('xlsx sheet reader', () => {
  it('reads shared, inline and numeric cells by column', () => {
    expect(shared).toEqual(['Choice 1', 'Kiss, Bob & Co', '']);
    const rows = parseSheet(sheet, shared);
    expect(rows.map((r) => r.index)).toEqual([1, 2, 4, 5]);
    expect(rows[1]!.cells).toEqual(['12', null, 'Kiss, Bob & Co', null]);
    expect(rows[3]!.cells[1]).toBe('élan');
    expect(rows[3]!.cells[26]).toBe('x');
  });

  it('gives the same rows however the XML is chunked', () => {
    const whole = parseSheet(sheet, shared);
    for (const size of [1, 7, 33]) {
      const reader = new SheetRowReader(shared);
      const rows = [];
      for (let i = 0; i < sheet.length; i += size) rows.push(...reader.push(sheet.slice(i, i + size)));
      expect(rows).toEqual(whole);
    }
  });
});
