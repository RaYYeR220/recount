/**
 * Largest-remainder (Hamilton) apportionment: splits `total` whole seats among
 * non-negative weights in proportion, exactly, with bigint arithmetic. Every seat
 * is handed out, so the parts always sum to `total`. Ties on the remainder go to
 * the larger weight, then to the earlier entry.
 */
export function apportion(total: number, weights: readonly bigint[]): number[] {
  if (!Number.isInteger(total) || total < 0) throw new RangeError(`total must be a whole number >= 0, got ${total}`);
  const sum = weights.reduce((a, w) => {
    if (w < 0n) throw new RangeError("weights must be non-negative");
    return a + w;
  }, 0n);
  if (weights.length === 0) {
    if (total > 0) throw new RangeError("nothing to apportion seats to");
    return [];
  }
  // No weight at all: share evenly from the front so nothing is lost.
  if (sum === 0n) return weights.map((_, i) => Math.floor(total / weights.length) + (i < total % weights.length ? 1 : 0));

  const T = BigInt(total);
  const parts = weights.map((w) => Number((T * w) / sum));
  const rest = weights.map((w, i) => ({ i, w, r: (T * w) % sum }));
  let left = total - parts.reduce((a, b) => a + b, 0);
  rest.sort((a, b) => (a.r !== b.r ? (b.r > a.r ? 1 : -1) : a.w !== b.w ? (b.w > a.w ? 1 : -1) : a.i - b.i));
  for (const { i } of rest) {
    if (left === 0) break;
    parts[i]!++;
    left--;
  }
  return parts;
}

/** Floating weights (visual heuristics only) scaled to integers for apportion(). */
export function apportionNumbers(total: number, weights: readonly number[]): number[] {
  return apportion(
    total,
    weights.map((w) => BigInt(Math.max(0, Math.round(w * 1e6)))),
  );
}
