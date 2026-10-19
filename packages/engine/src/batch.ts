import type { Fixed } from './fixed';
import type { CandidateId } from './types';

/**
 * Largest group of lowest candidates that cannot catch the next candidate up even if
 * they pooled every vote among them (plus `slack`, e.g. undistributed surplus).
 * At least `keep` candidates always survive. Returns [] when no group qualifies.
 */
export function batchLosers(
  standings: ReadonlyArray<readonly [CandidateId, Fixed]>,
  slack: Fixed,
  keep: number,
): CandidateId[] {
  const sorted = [...standings].sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
  let best = 0;
  let sum = slack;
  for (let k = 1; k <= sorted.length - Math.max(keep, 1); k++) {
    sum += sorted[k - 1]![1];
    if (sum < sorted[k]![1]) best = k;
  }
  return sorted.slice(0, best).map(([id]) => id);
}
