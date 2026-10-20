/**
 * Candidate names as people read them. Some official reports print "Peltola, Mary S.";
 * pages show "Mary S. Peltola" and plaques show the surname.
 */

const SUFFIX = /^(jr|sr|ii|iii|iv)\.?$/i;

/** "Peltola, Mary S." → "Mary S. Peltola"; anything without a comma stays as it is. */
export function personName(name: string): string {
  const m = /^([^,]+),\s*(.+)$/.exec(name.trim());
  return m ? `${m[2]} ${m[1]}` : name;
}

/** "Zohran Kwame Mamdani" → "Mamdani", "Peltola, Mary S." → "Peltola", "Martin Luther King Jr." → "King". */
export function surname(name: string): string {
  const trimmed = name.trim();
  const comma = trimmed.indexOf(",");
  if (comma > 0) return trimmed.slice(0, comma).trim();
  const words = trimmed.split(/\s+/).filter((w) => !/^\(.*\)$/.test(w));
  while (words.length > 1 && SUFFIX.test(words.at(-1)!)) words.pop();
  return words.at(-1) ?? trimmed;
}

/** "Ash", "Ash and Bea", "Ash, Bea and Cal". */
export function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}
