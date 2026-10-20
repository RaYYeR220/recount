import type { RctabSummary } from "@recount/engine";
import { findPoll } from "../authz";
import type { Db } from "../db/client";
import { DomainError } from "../errors";
import { pollStatus, type PollStatus } from "../polls/status";
import { countPoll, ensureSnapshot, type ResultsSnapshot } from "./snapshot";
import type { CountedResults } from "./tabulatePoll";
import { canSeeResults } from "./visibility";

export type PollResults = CountedResults & { status: PollStatus; isSnapshot: boolean };

async function visibleCount(
  db: Db,
  viewerId: string | null,
  slug: string,
  now: Date,
): Promise<{ snapshot: ResultsSnapshot; status: PollStatus }> {
  const poll = await findPoll(db, slug);
  const access = canSeeResults(poll, viewerId, now);
  if (access !== "yes") throw new DomainError(access);
  const status = pollStatus(poll, now);
  const snapshot = status === "closed" ? await ensureSnapshot(db, poll, now) : await countPoll(db, poll, now);
  return { snapshot, status };
}

/** Closed polls serve their snapshot; open ones are recounted from the current CVR. */
export async function getResults(
  db: Db,
  viewerId: string | null,
  slug: string,
  now: Date,
): Promise<PollResults> {
  const { snapshot, status } = await visibleCount(db, viewerId, slug, now);
  return { ...snapshot.results, status, isSnapshot: status === "closed" };
}

export async function getResultsRctab(
  db: Db,
  viewerId: string | null,
  slug: string,
  now: Date,
): Promise<RctabSummary> {
  return (await visibleCount(db, viewerId, slug, now)).snapshot.rctab;
}
