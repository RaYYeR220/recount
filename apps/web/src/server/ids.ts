export const ID_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

export function randomString(length: number, alphabet: string = ID_ALPHABET): string {
  const unbiasedLimit = 256 - (256 % alphabet.length);
  const out: string[] = [];
  const bytes = new Uint8Array(length * 2);
  while (out.length < length) {
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte < unbiasedLimit && out.length < length) out.push(alphabet[byte % alphabet.length]);
    }
  }
  return out.join("");
}

export function newSlug(): string {
  return randomString(10);
}
