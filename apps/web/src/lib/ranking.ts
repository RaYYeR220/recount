/**
 * A ballot's ranking as a list of option ids, first choice first. Every change
 * returns a new list; an id that is not where the change expects leaves it as is.
 */

/** Adds an option as the next choice, unless it is ranked already or the ballot is full. */
export function rankOption(ranking: readonly string[], id: string, maxRanks: number | null = null): string[] {
  if (ranking.includes(id)) return [...ranking];
  if (maxRanks !== null && ranking.length >= maxRanks) return [...ranking];
  return [...ranking, id];
}

/** Takes an option off; the choices below it move up one place. */
export function removeOption(ranking: readonly string[], id: string): string[] {
  return ranking.filter((x) => x !== id);
}

function swap(ranking: readonly string[], i: number, j: number): string[] {
  const next = [...ranking];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

/** Swaps an option with the one ranked just above it. */
export function moveUp(ranking: readonly string[], id: string): string[] {
  const i = ranking.indexOf(id);
  return i > 0 ? swap(ranking, i, i - 1) : [...ranking];
}

/** Swaps an option with the one ranked just below it. */
export function moveDown(ranking: readonly string[], id: string): string[] {
  const i = ranking.indexOf(id);
  return i >= 0 && i < ranking.length - 1 ? swap(ranking, i, i + 1) : [...ranking];
}

const ORDINAL_SUFFIX: Record<string, string> = { one: "st", two: "nd", few: "rd", other: "th" };
const ordinalRules = new Intl.PluralRules("en-US", { type: "ordinal" });

/** "1st", "2nd", "23rd". */
export function ordinal(n: number): string {
  return `${n}${ORDINAL_SUFFIX[ordinalRules.select(n)]}`;
}
