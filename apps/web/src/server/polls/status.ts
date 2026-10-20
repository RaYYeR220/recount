import { sql, type SQL } from "drizzle-orm";
import { poll } from "../db/schema";

export type PollStatus = "scheduled" | "open" | "closed";

type Schedule = {
  opensAt: Date | null;
  closesAt: Date | null;
  closedEarlyAt: Date | null;
  createdAt: Date;
};

export function pollStatus(p: Schedule, now: Date): PollStatus {
  const t = now.getTime();
  if (p.closedEarlyAt && t >= p.closedEarlyAt.getTime()) return "closed";
  if (p.closesAt && t >= p.closesAt.getTime()) return "closed";
  if (t < (p.opensAt ?? p.createdAt).getTime()) return "scheduled";
  return "open";
}

/** When the poll stopped taking ballots, or null while it has not. */
export function closedSince(p: Schedule, now: Date): Date | null {
  const t = now.getTime();
  const ends = [p.closedEarlyAt, p.closesAt]
    .filter((d): d is Date => d !== null && d.getTime() <= t)
    .map((d) => d.getTime());
  return ends.length > 0 ? new Date(Math.min(...ends)) : null;
}

/** The SQL twin of `pollStatus`, for filtering lists in the database. */
export function statusCondition(status: PollStatus, now: Date): SQL {
  const at = sql`${now.toISOString()}::timestamptz`;
  const closed = sql`(coalesce(${poll.closedEarlyAt} <= ${at}, false) or coalesce(${poll.closesAt} <= ${at}, false))`;
  const opensAt = sql`coalesce(${poll.opensAt}, ${poll.createdAt})`;

  if (status === "closed") return closed;
  if (status === "scheduled") return sql`(not ${closed} and ${opensAt} > ${at})`;
  return sql`(not ${closed} and ${opensAt} <= ${at})`;
}
