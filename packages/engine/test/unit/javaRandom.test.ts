import { describe, expect, it } from 'vitest';
import { JavaRandom, javaShuffle } from '../../src/javaRandom';

// Reference values produced by OpenJDK 21 (java.util.Random, Collections.shuffle).
describe('JavaRandom', () => {
  it('matches nextInt for seed 0', () => {
    const rnd = new JavaRandom(0n);
    expect(Array.from({ length: 5 }, () => rnd.nextInt(100))).toEqual([60, 48, 29, 47, 15]);
  });

  it('matches nextDouble', () => {
    expect(new JavaRandom(42n).nextDouble()).toBe(0.7275636800328681);
    expect(new JavaRandom(0n).nextDouble()).toBe(0.730967787376657);
    const one = new JavaRandom(1n);
    expect([one.nextDouble(), one.nextDouble()]).toEqual([0.7308781907032909, 0.41008081149220166]);
    const r = new JavaRandom(12345n);
    expect([r.nextDouble(), r.nextDouble(), r.nextDouble()]).toEqual([
      0.3618031071604718, 0.932993485288541, 0.8330913489710237,
    ]);
  });

  it('handles negative seeds, power-of-two bounds and interleaved calls', () => {
    const rnd = new JavaRandom(-7n);
    expect(rnd.nextInt(7)).toBe(4);
    expect(rnd.nextInt(1 << 20)).toBe(945288);
    expect(rnd.nextInt(1 << 30)).toBe(722822795);
    expect(rnd.nextDouble()).toBe(0.9458454776032215);
    expect(rnd.nextInt(16)).toBe(2);
  });

  it('accepts the full documented seed range', () => {
    expect(new JavaRandom(140737488355327n).nextDouble()).toBe(0.7689426383310856);
    expect(new JavaRandom(-140737488355328n).nextDouble()).toBe(0.23096777992607642);
  });

  it('rejects a non-positive bound', () => {
    expect(() => new JavaRandom(0n).nextInt(0)).toThrow(RangeError);
  });
});

describe('javaShuffle', () => {
  it('matches Collections.shuffle', () => {
    expect(javaShuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], new JavaRandom(99n))).toEqual([8, 1, 4, 3, 9, 6, 0, 2, 5, 7]);
    expect(
      javaShuffle(['George Gervin', 'Mookie Blaylock', 'Sedale Threatt', 'Yinka Dare'], new JavaRandom(12345n)),
    ).toEqual(['George Gervin', 'Sedale Threatt', 'Yinka Dare', 'Mookie Blaylock']);
  });

  it('does not mutate its input', () => {
    const items = [1, 2, 3];
    javaShuffle(items, new JavaRandom(5n));
    expect(items).toEqual([1, 2, 3]);
  });
});
