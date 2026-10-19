/** A worksheet row: 1-based row number and cell values by 0-based column. */
export interface SheetRow {
  index: number;
  cells: Array<string | null>;
}

const ENTITY: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeXml(s: string): string {
  if (!s.includes('&')) return s;
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_, e: string) =>
    e.startsWith('#x')
      ? String.fromCodePoint(parseInt(e.slice(2), 16))
      : e.startsWith('#')
        ? String.fromCodePoint(parseInt(e.slice(1), 10))
        : ENTITY[e]!,
  );
}

function textOf(xml: string): string {
  let out = '';
  for (const m of xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) out += m[1];
  return decodeXml(out);
}

export function parseSharedStrings(xml: string): string[] {
  return Array.from(xml.matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g), (m) => (m[1] === undefined ? '' : textOf(m[1])));
}

function sharedString(shared: readonly string[], ref: string): string {
  const value = shared[Number(ref)];
  if (value === undefined) throw new Error(`worksheet refers to missing shared string ${ref}`);
  return value;
}

function columnIndex(ref: string): number {
  let n = 0;
  for (let i = 0; i < ref.length; i++) {
    const c = ref.charCodeAt(i);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

const ROW = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
const CELL = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;

function parseRow(attrs: string, body: string | undefined, shared: readonly string[], fallback: number): SheetRow {
  const index = Number(/\br="(\d+)"/.exec(attrs)?.[1] ?? fallback);
  const cells: Array<string | null> = [];
  if (body) {
    let next = 0;
    for (const m of body.matchAll(CELL)) {
      const cellAttrs = m[1]!;
      const ref = /\br="([A-Z]+)\d*"/.exec(cellAttrs)?.[1];
      const col = ref ? columnIndex(ref) : next;
      next = col + 1;
      const type = /\bt="(\w+)"/.exec(cellAttrs)?.[1];
      const inner = m[2] ?? '';
      let value: string | null = null;
      if (type === 'inlineStr') value = textOf(inner);
      else {
        const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
        if (v !== undefined) value = type === 's' ? sharedString(shared, v) : decodeXml(v);
      }
      while (cells.length < col) cells.push(null);
      cells[col] = value;
    }
  }
  return { index, cells };
}

/**
 * Incremental worksheet reader: feed XML text in chunks of any size and get back the
 * rows completed so far. Lets callers stream sheets too large for one string.
 */
export class SheetRowReader {
  private buffer = '';
  private lastIndex = 0;

  constructor(private readonly shared: readonly string[]) {}

  push(chunk: string): SheetRow[] {
    this.buffer += chunk;
    const rows: SheetRow[] = [];
    let consumed = 0;
    ROW.lastIndex = 0;
    for (let m = ROW.exec(this.buffer); m; m = ROW.exec(this.buffer)) {
      const row = parseRow(m[1]!, m[2], this.shared, this.lastIndex + 1);
      this.lastIndex = row.index;
      rows.push(row);
      consumed = ROW.lastIndex;
    }
    this.buffer = this.buffer.slice(consumed);
    return rows;
  }
}

export function parseSheet(xml: string, shared: readonly string[]): SheetRow[] {
  return new SheetRowReader(shared).push(xml);
}
