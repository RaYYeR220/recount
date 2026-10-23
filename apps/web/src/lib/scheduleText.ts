import type { PollStatus } from "@/server/polls/status";
import { formatWhen } from "./when";

export type ScheduleFacts = {
  status: PollStatus;
  timeZone: string;
  opensAt: Date | null;
  closesAt: Date | null;
  closedEarlyAt: Date | null;
  createdAt: Date;
};

/** When voting stopped: the earlier of closing early and the planned close. */
export function closedAt(p: Pick<ScheduleFacts, "closesAt" | "closedEarlyAt">): Date | null {
  const ends = [p.closedEarlyAt, p.closesAt].filter((d): d is Date => d !== null);
  return ends.length > 0 ? new Date(Math.min(...ends.map((d) => d.getTime()))) : null;
}

/**
 * The one schedule fact that matters for the poll's status, in its own zone:
 * "Opens Jan 15, 2027, 12:00 PM", "Closes …", "Closed …" or "No closing time".
 * The zone itself is printed next to it by the caller.
 */
export function scheduleLine(p: ScheduleFacts, { short = true }: { short?: boolean } = {}): string {
  const when = (d: Date) => formatWhen(d, p.timeZone, { short });
  if (p.status === "scheduled") return `Opens ${when(p.opensAt ?? p.createdAt)}`;
  if (p.status === "open") return p.closesAt ? `Closes ${when(p.closesAt)}` : "No closing time";
  const end = closedAt(p);
  return end ? `Closed ${when(end)}` : "Closed";
}
