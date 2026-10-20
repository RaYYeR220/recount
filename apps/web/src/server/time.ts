import { Temporal } from "temporal-polyfill";

export type DstWarning = "dst_gap_shifted" | "dst_overlap_earlier";

const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

let zones: Set<string> | undefined;

/**
 * IANA names only, aliases included: ICU may list "Asia/Calcutta" while a
 * browser reports "Asia/Kolkata", so each name is canonicalised first.
 */
export function isValidTimeZone(timeZone: string): boolean {
  zones ??= new Set([...Intl.supportedValuesOf("timeZone"), "UTC"]);
  try {
    const canonical = new Intl.DateTimeFormat("en-US", { timeZone }).resolvedOptions().timeZone;
    return zones.has(canonical);
  } catch {
    return false;
  }
}

export function isLocalDateTime(value: string): boolean {
  if (!LOCAL_DATE_TIME.test(value)) return false;
  try {
    Temporal.PlainDateTime.from(value, { overflow: "reject" });
    return true;
  } catch {
    return false;
  }
}

/**
 * A wall time that does not exist (spring-forward gap) moves forward by the
 * gap; one that happens twice (fall-back overlap) takes the earlier instant.
 */
export function resolveLocal(
  local: string,
  timeZone: string,
): { instant: Date; warning: DstWarning | null } {
  const wall = Temporal.PlainDateTime.from(local, { overflow: "reject" });
  const resolved = wall.toZonedDateTime(timeZone, { disambiguation: "compatible" });
  const later = wall.toZonedDateTime(timeZone, { disambiguation: "later" });

  let warning: DstWarning | null = null;
  if (!resolved.toPlainDateTime().equals(wall)) warning = "dst_gap_shifted";
  else if (resolved.epochMilliseconds !== later.epochMilliseconds) warning = "dst_overlap_earlier";

  return { instant: new Date(resolved.epochMilliseconds), warning };
}
