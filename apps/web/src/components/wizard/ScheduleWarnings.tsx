import { Callout } from "@/components/ui";
import { scheduleWarningText } from "@/lib/when";
import type { ScheduleWarning } from "@/server/polls/schedule";

export type ScheduleWarningsProps = {
  /** Which time these warnings sit under. */
  field: ScheduleWarning["field"];
  /** The DST warnings createPoll gave for this schedule. */
  warnings: ScheduleWarning[];
  /** The wall times they are about, as sent: "2027-03-14T02:30". */
  opensAtLocal: string | null;
  closesAtLocal: string | null;
  opensAt: Date | null;
  closesAt: Date | null;
  timeZone: string;
};

/**
 * The DST warnings from the poll service for one of the two times, each as one plain
 * sentence, right under that time's field. The live region is always there, so a
 * warning that appears while typing is read out.
 */
export function ScheduleWarnings({ field, warnings, opensAtLocal, closesAtLocal, opensAt, closesAt, timeZone }: ScheduleWarningsProps) {
  const lines = warnings.filter((warning) => warning.field === field).flatMap((warning) => {
    const local = warning.field === "opensAt" ? opensAtLocal : closesAtLocal;
    const instant = warning.field === "opensAt" ? opensAt : closesAt;
    return local && instant ? [{ key: warning.field, text: scheduleWarningText(warning, local, timeZone, instant) }] : [];
  });
  return (
    <div className="grid gap-2 empty:hidden" role="status">
      {lines.map((line) => (
        <Callout key={line.key} tone="warn">
          {line.text}
        </Callout>
      ))}
    </div>
  );
}
