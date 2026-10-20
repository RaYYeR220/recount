import { resolveLocal, type DstWarning } from "../time";
import { validationError } from "../validation";

export type ScheduleWarning = { field: "opensAt" | "closesAt"; code: DstWarning };

const MIN_OPEN_MS = 60_000;

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

export function assertSchedule(opensAt: Date, closesAt: Date | null, now: Date): void {
  if (!closesAt) return;
  if (closesAt.getTime() <= now.getTime()) {
    throw validationError({ path: "closesAtLocal", message: "The closing time must be in the future" });
  }
  if (closesAt.getTime() < opensAt.getTime() + MIN_OPEN_MS) {
    throw validationError({
      path: "closesAtLocal",
      message: "The poll must stay open for at least a minute",
    });
  }
}
