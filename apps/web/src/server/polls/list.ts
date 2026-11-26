import { and, count, desc, eq, ilike, type SQL } from "drizzle-orm";
import type { Db } from "../db/client";
import { ballot, poll } from "../db/schema";
import type { PollRow } from "./detail";
import { pollStatus, statusCondition, type PollStatus } from "./status";

export type PollSummary = {
  slug: string;
  title: string;
  status: PollStatus;
  seats: number;
  presetId: string;
  accessMode: PollRow["accessMode"];
  resultsVisibility: PollRow["resultsVisibility"];
  timeZone: string;
  opensAt: Date | null;
  closesAt: Date | null;
  closedEarlyAt: Date | null;
  createdAt: Date;
  ballotCount: number;
};

export type ListQuery = {
  search?: string;
  status?: PollStatus;
  page?: number;
  pageSize?: number;
};

const MAX_PAGE_SIZE = 100;

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function listPolls(
  db: Db,
  ownerId: string,
  q: ListQuery,
  now: Date,
): Promise<{ items: PollSummary[]; total: number; page: number; pageCount: number }> {
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(q.pageSize ?? 20)));
  const page = Math.max(1, Math.floor(q.page ?? 1));

  const filters: SQL[] = [eq(poll.ownerId, ownerId)];
  const search = q.search?.trim();
  if (search) filters.push(ilike(poll.title, `%${escapeLike(search)}%`));
  if (q.status) filters.push(statusCondition(q.status, now));
  const where = and(...filters);

  const [{ total }] = await db.select({ total: count() }).from(poll).where(where);
  const rows = await db
    .select({
      slug: poll.slug,
      title: poll.title,
      seats: poll.seats,
      presetId: poll.presetId,
      accessMode: poll.accessMode,
      resultsVisibility: poll.resultsVisibility,
      timeZone: poll.timeZone,
      opensAt: poll.opensAt,
      closesAt: poll.closesAt,
      closedEarlyAt: poll.closedEarlyAt,
      createdAt: poll.createdAt,
      ballotCount: db.$count(ballot, eq(ballot.pollId, poll.id)),
    })
    .from(poll)
    .where(where)
    .orderBy(desc(poll.createdAt), desc(poll.id))
    .limit(pageSize)
    .offset(page * pageSize);

  return {
    items: rows.map((row) => ({ ...row, status: pollStatus(row, now) })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}
