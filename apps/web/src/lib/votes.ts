/**
 * Vote figures arrive from the engine as decimal strings: "573169" for whole votes,
 * "6.8000" for fractional STV values at the count's decimal places. These helpers do
 * exact arithmetic on them as scaled bigints and print them the way the engine does,
 * never through floating point.
 */

const DECIMAL = /^(-?)(\d+)(?:\.(\d+))?$/;

/** Decimal places in one engine figure ("6.8000" has 4, "7" has 0). */
export function placesOf(value: string): number {
  const m = DECIMAL.exec(value);
  if (!m) throw new SyntaxError(`not a vote figure: ${JSON.stringify(value)}`);
  return m[3]?.length ?? 0;
}

/** The most decimal places among a set of figures: the scale they share. */
export function sharedPlaces(values: Iterable<string>): number {
  let dp = 0;
  for (const v of values) dp = Math.max(dp, placesOf(v));
  return dp;
}

/** A figure as an integer number of 10^-dp units. Exact when dp covers its decimals. */
export function toUnits(value: string, dp: number): bigint {
  const m = DECIMAL.exec(value);
  if (!m) throw new SyntaxError(`not a vote figure: ${JSON.stringify(value)}`);
  const [, sign, whole, frac = ""] = m;
  if (frac.length > dp) throw new RangeError(`${value} has more than ${dp} decimal places`);
  const units = BigInt(whole!) * 10n ** BigInt(dp) + (dp > 0 ? BigInt(frac.padEnd(dp, "0")) : 0n);
  return sign === "-" ? -units : units;
}

/**
 * Engine formatting: whole values as integers, anything else at full scale
 * ("2.3330"). No thousands separators; see formatVotes for display.
 */
export function fromUnits(units: bigint, dp: number): string {
  const scale = 10n ** BigInt(dp);
  const negative = units < 0n;
  const abs = negative ? -units : units;
  const whole = abs / scale;
  const frac = abs % scale;
  const sign = negative ? "-" : "";
  if (dp === 0 || frac === 0n) return `${sign}${whole}`;
  return `${sign}${whole}.${frac.toString().padStart(dp, "0")}`;
}

/**
 * A figure for display: thousands separators on the whole part (en-US), the
 * fraction exactly as the engine printed it. "1114433" → "1,114,433", "6.8000" stays.
 */
export function formatVotes(value: string): string {
  const m = DECIMAL.exec(value);
  if (!m) throw new SyntaxError(`not a vote figure: ${JSON.stringify(value)}`);
  const [, sign, whole, frac] = m;
  const grouped = BigInt(whole!).toLocaleString("en-US");
  return `${sign ? "−" : ""}${grouped}${frac !== undefined ? `.${frac}` : ""}`;
}

/** Display form of a scaled value. */
export function formatUnits(units: bigint, dp: number): string {
  return formatVotes(fromUnits(units, dp));
}

/** "+1.8000" or "−3" (true minus sign); null when nothing changed. */
export function formatDelta(units: bigint, dp: number): string | null {
  if (units === 0n) return null;
  const abs = units < 0n ? -units : units;
  return `${units > 0n ? "+" : "−"}${formatUnits(abs, dp)}`;
}

/** A plain number for display, e.g. a ballot count from the database. */
export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}
