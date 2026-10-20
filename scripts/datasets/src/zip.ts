import { Readable } from 'node:stream';
import { createInflateRaw, inflateRawSync } from 'node:zlib';

export interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  dataStart: number;
}

/** Lists a zip archive's entries from its central directory (no zip64, no encryption). */
export function zipEntries(buf: Buffer): ZipEntry[] {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('not a zip archive');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  if (p === 0xffffffff) throw new Error('zip64 archives are not supported');

  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('corrupt zip central directory');
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const nameLength = buf.readUInt16LE(p + 28);
    const extraLength = buf.readUInt16LE(p + 30);
    const commentLength = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLength);
    if (buf.readUInt32LE(local) !== 0x04034b50) throw new Error(`corrupt local header for ${name}`);
    const dataStart = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    entries.push({ name, method, compressedSize, dataStart });
    p += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function raw(buf: Buffer, entry: ZipEntry): Buffer {
  if (entry.method !== 0 && entry.method !== 8) throw new Error(`unsupported compression ${entry.method} in ${entry.name}`);
  return buf.subarray(entry.dataStart, entry.dataStart + entry.compressedSize);
}

export function readEntry(buf: Buffer, entry: ZipEntry): Buffer {
  const data = raw(buf, entry);
  return entry.method === 0 ? Buffer.from(data) : inflateRawSync(data);
}

/** Decompresses an entry as UTF-8 text in chunks, for members too large to hold as one string. */
export async function* streamEntryText(buf: Buffer, entry: ZipEntry): AsyncGenerator<string> {
  const data = raw(buf, entry);
  const source = Readable.from([data]);
  const stream = entry.method === 0 ? source : source.pipe(createInflateRaw());
  const decoder = new TextDecoder('utf-8');
  for await (const chunk of stream) yield decoder.decode(chunk as Buffer, { stream: true });
  const tail = decoder.decode();
  if (tail) yield tail;
}

export function findEntry(entries: ZipEntry[], name: string): ZipEntry {
  const entry = entries.find((e) => e.name === name);
  if (!entry) throw new Error(`zip has no ${name}`);
  return entry;
}
