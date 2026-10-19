const MULTIPLIER = 0x5deece66dn;
const ADDEND = 0xbn;
const MASK = (1n << 48n) - 1n;
const DOUBLE_UNIT = 2 ** -53;

/** java.util.Random (48-bit LCG), so seeded tiebreaks agree with RCTab. */
export class JavaRandom {
  private seed: bigint;

  constructor(seed: bigint) {
    this.seed = (seed ^ MULTIPLIER) & MASK;
  }

  private next(bits: number): number {
    this.seed = (this.seed * MULTIPLIER + ADDEND) & MASK;
    return Number(this.seed >> BigInt(48 - bits)) | 0;
  }

  nextInt(bound: number): number {
    if (!Number.isInteger(bound) || bound <= 0 || bound > 0x7fffffff) {
      throw new RangeError(`bound must be a positive int, got ${bound}`);
    }
    if ((bound & -bound) === bound) {
      return Number((BigInt(bound) * BigInt(this.next(31))) >> 31n);
    }
    let bits: number;
    let val: number;
    do {
      bits = this.next(31);
      val = bits % bound;
    } while (((bits - val + (bound - 1)) | 0) < 0);
    return val;
  }

  nextDouble(): number {
    return (this.next(26) * 2 ** 27 + this.next(27)) * DOUBLE_UNIT;
  }
}

/** Collections.shuffle(list, rnd) on a copy of the input. */
export function javaShuffle<T>(items: readonly T[], rnd: JavaRandom): T[] {
  const out = items.slice();
  for (let i = out.length; i > 1; i--) {
    const j = rnd.nextInt(i);
    const tmp = out[i - 1]!;
    out[i - 1] = out[j]!;
    out[j] = tmp;
  }
  return out;
}
