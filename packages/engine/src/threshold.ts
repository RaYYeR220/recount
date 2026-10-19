import { divTrunc, type Fixed, makeScale } from './fixed';
import { isMultiWinner, type Rules } from './rules';

export interface Threshold {
  value: Fixed;
  /** True when the threshold carries decimals (RCTab's nonIntegerWinningThreshold). */
  fractional: boolean;
}

/**
 * Droop: floor(V / (S + 1)) + 1, or V / (S + 1) + 10^-dp when non-integer thresholds are on.
 * Hare: V / S (RCTab's 2013 Minneapolis Hare fixture prints 19821 for 59463 votes, 3 seats).
 * Single-seat counts use a simple majority of the active votes, floor(V / 2) + 1.
 */
export function computeThreshold(votes: Fixed, rules: Rules): Threshold {
  const dp = rules.decimalPlacesForVoteArithmetic;
  const scale = makeScale(dp);
  const multi = isMultiWinner(rules);
  const seats = BigInt(Math.max(rules.numberOfWinners, 1));
  const hare = multi && rules.hareQuota;
  const divisor = hare ? seats : seats + 1n;

  if (multi && rules.nonIntegerWinningThreshold) {
    const quota = divTrunc(votes, divisor * scale, dp);
    return { value: hare ? quota : quota + 1n, fractional: true };
  }
  const whole = votes / (divisor * scale);
  return { value: (hare ? whole : whole + 1n) * scale, fractional: false };
}
