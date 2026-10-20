import { createHash } from "node:crypto";

/** A string drawn from `alphabet`, fixed by `seed`, so seeded receipts and codes are the same everywhere. */
export function seededString(seed: string, length: number, alphabet: string): string {
  const limit = 256 - (256 % alphabet.length);
  const out: string[] = [];
  for (let round = 0; out.length < length; round++) {
    for (const byte of createHash("sha256").update(`${seed}#${round}`).digest()) {
      if (byte < limit && out.length < length) out.push(alphabet[byte % alphabet.length]);
    }
  }
  return out.join("");
}

/** mulberry32: small, fast and deterministic, plenty for demo ballots. */
export function prng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
