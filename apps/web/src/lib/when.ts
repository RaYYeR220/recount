import type { ScheduleWarning } from "@/server/polls/schedule";

/**
 * Times as people read them, always in a named zone. Every helper takes the zone
 * explicitly, so nothing falls back to the viewer's clock. Output is assembled from
 * Intl parts with plain spaces: newer ICU puts a narrow no-break space before
 * "AM", which would make the same sentence differ between Node and browsers.
 */

const WALL_INPUT = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;
const WALL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export const WALL_INPUT_FORMAT = "YYYY-MM-DD HH:mm";

/** "2027-03-14 02:30" (what people type) to "2027-03-14T02:30" (what the services take); null if not that shape. */
export function parseWallInput(text: string): string | null {
  const m = WALL_INPUT.exec(text.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const days = new Date(Date.UTC(y!, mo!, 0)).getUTCDate();
  if (mo! < 1 || mo! > 12 || d! < 1 || d! > days || h! > 23 || mi! > 59) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`;
}

type Parts = Record<string, string>;

function parts(date: Date, timeZone: string, options: Intl.DateTimeFormatOptions): Parts {
  const out: Parts = {};
  for (const p of new Intl.DateTimeFormat("en-US", { timeZone, ...options }).formatToParts(date)) out[p.type] = p.value;
  return out;
}

/** The wall clock in a zone, in the typed form "2027-01-15 12:00". */
export function wallInZone(date: Date, timeZone: string): string {
  const p = parts(date, timeZone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

/** "3:30 AM" */
export function formatTime(date: Date, timeZone: string): string {
  const p = parts(date, timeZone, { hour: "numeric", minute: "2-digit", hourCycle: "h12" });
  return `${p.hour}:${p.minute} ${p.dayPeriod}`;
}

/** "January 15, 2027, 12:00 PM", or "Jan 15, 2027, 12:00 PM" when short. */
export function formatWhen(date: Date, timeZone: string, { short = false }: { short?: boolean } = {}): string {
  const p = parts(date, timeZone, { year: "numeric", month: short ? "short" : "long", day: "numeric" });
  return `${p.month} ${p.day}, ${p.year}, ${formatTime(date, timeZone)}`;
}

/** "January 15, 2027" */
export function formatDay(date: Date, timeZone: string): string {
  const p = parts(date, timeZone, { year: "numeric", month: "long", day: "numeric" });
  return `${p.month} ${p.day}, ${p.year}`;
}

/** The zone's short name at that instant: "EST", "EDT", or "GMT+2" where English has none. */
export function zoneAbbr(date: Date, timeZone: string): string {
  return parts(date, timeZone, { timeZoneName: "short" }).timeZoneName ?? timeZone;
}

/** "Opens January 15, 2027, 12:00 PM (America/New_York)" minus the verb: the time with its zone named. */
export function formatWhenInZone(date: Date, timeZone: string): string {
  return `${formatWhen(date, timeZone)} (${timeZone})`;
}

function wallParts(local: string): number[] {
  const m = WALL.exec(local);
  if (!m) throw new SyntaxError(`not a wall time: ${JSON.stringify(local)}`);
  return m.slice(1).map(Number);
}

/** "2:30 AM" for "2027-03-14T02:30": the time as typed, which may not exist in the zone. */
export function wallTime(local: string): string {
  const [, , , h, mi] = wallParts(local);
  return `${((h! + 11) % 12) + 1}:${String(mi).padStart(2, "0")} ${h! < 12 ? "AM" : "PM"}`;
}

/** "March 14, 2027" for "2027-03-14T02:30". */
export function wallDay(local: string): string {
  const [y, mo, d] = wallParts(local);
  return formatDay(new Date(Date.UTC(y!, mo! - 1, d!, 12)), "UTC");
}

/**
 * What a DST warning from the poll services means, in one sentence. `local` is the
 * wall time the organizer typed; `instant` is when the poll will actually open or close.
 */
export function scheduleWarningText(warning: ScheduleWarning, local: string, timeZone: string, instant: Date): string {
  const typed = wallTime(local);
  const day = wallDay(local);
  if (warning.code === "dst_gap_shifted") {
    const verb = warning.field === "opensAt" ? "open" : "close";
    return `${typed} doesn't exist on ${day} in ${timeZone} (clocks jump forward). We'll ${verb} the poll at ${formatTime(instant, timeZone)}.`;
  }
  return `${typed} happens twice on ${day} in ${timeZone}. We'll use the first one (${zoneAbbr(instant, timeZone)}).`;
}
