import { asc, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { ballot, poll, pollOption } from "../db/schema";
import type { ScheduleWarning } from "./schedule";
import { pollStatus, type PollStatus } from "./status";

export type PollRow = typeof poll.$inferSelect;
export type PollOptionView = { id: string; label: string; position: number };

export type PollDetail = {
  id: string;
  slug: string;
  ownerId: string;
  title: string;
  description: string;
  seats: number;
  presetId: string;
  maxRanks: number | null;
  accessMode: PollRow["accessMode"];
  resultsVisibility: PollRow["resultsVisibility"];
  timeZone: string;
  opensAt: Date | null;
  closesAt: Date | null;
  closedEarlyAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  status: PollStatus;
  options: PollOptionView[];
  ballotCount: number;
  warnings: ScheduleWarning[];
};

export function loadOptions(db: Db, pollId: string): Promise<PollOptionView[]> {
  return db
    .select({ id: pollOption.id, label: pollOption.label, position: pollOption.position })
    .from(pollOption)
    .where(eq(pollOption.pollId, pollId))
    .orderBy(asc(pollOption.position));
}

export function countBallots(db: Db, pollId: string): Promise<number> {
  return db.$count(ballot, eq(ballot.pollId, pollId));
}

export function toPollDetail(
  row: PollRow,
  options: PollOptionView[],
  ballotCount: number,
  now: Date,
  warnings: ScheduleWarning[] = [],
): PollDetail {
  return {
    id: row.id,
    slug: row.slug,
    ownerId: row.ownerId,
    title: row.title,
    description: row.description,
    seats: row.seats,
    presetId: row.presetId,
    maxRanks: row.maxRanks,
    accessMode: row.accessMode,
    resultsVisibility: row.resultsVisibility,
    timeZone: row.timeZone,
    opensAt: row.opensAt,
    closesAt: row.closesAt,
    closedEarlyAt: row.closedEarlyAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    status: pollStatus(row, now),
    options,
    ballotCount,
    warnings,
  };
}

export async function loadPollDetail(
  db: Db,
  row: PollRow,
  now: Date,
  warnings: ScheduleWarning[] = [],
): Promise<PollDetail> {
  const options = await loadOptions(db, row.id);
  const ballotCount = await countBallots(db, row.id);
  return toPollDetail(row, options, ballotCount, now, warnings);
}
