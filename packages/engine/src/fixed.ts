/** A non-negative decimal stored as an integer number of 10^-dp units. */
export type Fixed = bigint;

export function makeScale(dp: number): bigint {
  return 10n ** BigInt(dp);
}

export function fromInt(n: number | bigint, dp: number): Fixed {
  return BigInt(n) * makeScale(dp);
}

export function mulTrunc(a: Fixed, b: Fixed, dp: number): Fixed {
  return (a * b) / makeScale(dp);
}

export function divTrunc(a: Fixed, b: Fixed, dp: number): Fixed {
  if (b === 0n) throw new RangeError('fixed-point division by zero');
  return (a * makeScale(dp) + b / 2n) / b;
}

/**
 * Whole values print as integers, anything else at full scale ("2.3330"), matching
 * Java BigDecimal output in RCTab reports. `fullScale` forces the decimals even for
 * whole values, which RCTab does for totals that went through a fractional transfer.
 */
export function formatFixed(v: Fixed, dp: number, fullScale = false): string {
  const scale = makeScale(dp);
  const negative = v < 0n;
  const abs = negative ? -v : v;
  const whole = abs / scale;
  const frac = abs % scale;
  const sign = negative ? '-' : '';
  if (dp === 0 || (frac === 0n && !fullScale)) return `${sign}${whole}`;
  return `${sign}${whole}.${frac.toString().padStart(dp, '0')}`;
}

/** Parses a plain decimal string, truncating digits beyond dp. */
export function parseFixed(s: string, dp: number): Fixed {
  const m = /^(-?)(\d+)(?:\.(\d*))?$/.exec(s.trim());
  if (!m) throw new SyntaxError(`not a decimal number: ${JSON.stringify(s)}`);
  const [, sign = '', whole = '0', frac = ''] = m;
  const digits = frac.slice(0, dp).padEnd(dp, '0');
  const v = BigInt(whole) * makeScale(dp) + (dp > 0 ? BigInt(digits) : 0n);
  return sign === '-' ? -v : v;
}
