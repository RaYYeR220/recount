import { findOwnedPoll, findPoll } from "../authz";
import type { Db } from "../db/client";
import { loadOptions, loadPollDetail, type PollDetail, type PollRow } from "./detail";
import { pollStatus, type PollStatus } from "./status";

export type PublicPoll = {
  slug: string;
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
  status: PollStatus;
  options: Array<{ id: string; label: string }>;
};

export async function getPollForOwner(
  db: Db,
  actorId: string | null,
  slug: string,
  now: Date,
): Promise<PollDetail> {
  return loadPollDetail(db, await findOwnedPoll(db, actorId, slug), now);
}

export async function getPublicPoll(db: Db, slug: string, now: Date): Promise<PublicPoll> {
  const row = await findPoll(db, slug);
  const options = await loadOptions(db, row.id);
  return {
    slug: row.slug,
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
    status: pollStatus(row, now),
    options: options.map(({ id, label }) => ({ id, label })),
  };
}
