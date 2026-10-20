/** RFC 4180 CSV: calls `onRow` for every record, quotes and embedded newlines included. */
export function parseCsv(text: string, onRow: (fields: string[]) => void): void {
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  const n = text.length;
  let row: string[] = [];
  let field = '';
  while (i < n) {
    const c = text[i]!;
    if (c === '"') {
      i++;
      for (;;) {
        const q = text.indexOf('"', i);
        if (q < 0) throw new Error('unterminated quoted CSV field');
        field += text.slice(i, q);
        i = q + 1;
        if (text[i] === '"') {
          field += '"';
          i++;
        } else break;
      }
    } else if (c === ',') {
      row.push(field);
      field = '';
      i++;
    } else if (c === '\n' || c === '\r') {
      row.push(field);
      onRow(row);
      row = [];
      field = '';
      i += c === '\r' && text[i + 1] === '\n' ? 2 : 1;
    } else {
      let j = i;
      while (j < n && text[j] !== ',' && text[j] !== '\n' && text[j] !== '\r' && text[j] !== '"') j++;
      field += text.slice(i, j);
      i = j;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    onRow(row);
  }
}
