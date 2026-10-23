/**
 * CLDR, and so ICU and Node, still names a few zones by what IANA called them before
 * renaming them (Asia/Calcutta, Europe/Kiev), and lists only that name. These are the
 * names IANA uses now; every other name is the same in both.
 */
const RENAMED: Record<string, string> = {
  "Africa/Asmera": "Africa/Asmara",
  "America/Buenos_Aires": "America/Argentina/Buenos_Aires",
  "America/Catamarca": "America/Argentina/Catamarca",
  "America/Coral_Harbour": "America/Atikokan",
  "America/Cordoba": "America/Argentina/Cordoba",
  "America/Godthab": "America/Nuuk",
  "America/Indianapolis": "America/Indiana/Indianapolis",
  "America/Jujuy": "America/Argentina/Jujuy",
  "America/Louisville": "America/Kentucky/Louisville",
  "America/Mendoza": "America/Argentina/Mendoza",
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Rangoon": "Asia/Yangon",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Atlantic/Faeroe": "Atlantic/Faroe",
  "Europe/Kiev": "Europe/Kyiv",
  "Pacific/Enderbury": "Pacific/Kanton",
  "Pacific/Ponape": "Pacific/Pohnpei",
  "Pacific/Truk": "Pacific/Chuuk",
};

/** The zone under the name IANA gives it today. */
export function ianaName(zone: string): string {
  return RENAMED[zone] ?? zone;
}

/** The zones to choose from, each once under its IANA name: UTC first, then by name. */
export function zoneChoices(supported: readonly string[]): string[] {
  const names = new Set(supported.map(ianaName));
  names.delete("UTC");
  return ["UTC", ...[...names].sort()];
}
