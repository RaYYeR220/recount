import { resolveLocal, type DstWarning } from "../time";
import { validationError, type Issue } from "../validation";

export type ScheduleWarning = { field: "opensAt" | "closesAt"; code: DstWarning };

const MIN_OPEN_MS = 60_000;
/** Times are typed to the minute, so the minute that is under way still counts as now. */
const OPENING_GRACE_MS = 60_000;

export function toInstant(
  field: ScheduleWarning["field"],
  local: string,
  timeZone: string,
  warnings: ScheduleWarning[],
): Date {
  const { instant, warning } = resolveLocal(local, timeZone);
  if (warning) warnings.push({ field, code: warning });
  return instant;
}

/**
 * An opening time that has already passed is refused only when the caller sets it
 * (`openingSet`), so an open poll can still move its closing time.
 */
export function assertSchedule(
  opensAt: Date,
  closesAt: Date | null,
  now: Date,
  { openingSet = false }: { openingSet?: boolean } = {},
): void {
  const issues: Issue[] = [];
  if (openingSet && opensAt.getTime() < now.getTime() - OPENING_GRACE_MS) {
    issues.push({
      path: "opensAtLocal",
      message: "The opening time has already passed. Pick a later time, or open the poll as soon as it's created.",
    });
  }
  if (closesAt && closesAt.getTime() <= now.getTime()) {
    issues.push({ path: "closesAtLocal", message: "The closing time must be in the future" });
  } else if (closesAt && closesAt.getTime() < opensAt.getTime()) {
    issues.push({ path: "closesAtLocal", message: "The closing time must come after the opening time" });
  } else if (closesAt && closesAt.getTime() < opensAt.getTime() + MIN_OPEN_MS) {
    issues.push({ path: "closesAtLocal", message: "The poll must stay open for at least a minute" });
  }
  if (issues.length > 0) throw validationError(...issues);
}
