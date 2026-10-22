import type { RctabSummary } from "@recount/engine";
import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "../db/client";
import { poll as pollTable } from "../db/schema";
import { DomainError } from "../errors";
import type { PollRow } from "../polls/detail";
import { closedSince } from "../polls/status";
import { loadCvr } from "./cvr";
import { tabulatePoll, type CountedResults } from "./tabulatePoll";

export type ResultsSnapshot = { results: CountedResults; rctab: RctabSummary };

export async function countPoll(db: Db, poll: PollRow, now: Date): Promise<ResultsSnapshot> {
  return tabulatePoll(poll, await loadCvr(db, poll), closedSince(poll, now));
}

/**
 * Polls that closed on schedule get their snapshot the first time anyone reads the
 * results. Casts share-lock the poll row, so taking it for update waits out any
 * ballot still in flight, and a cast that comes after sees the snapshot and stops.
 */
export async function ensureSnapshot(db: Db, poll: PollRow, now: Date): Promise<ResultsSnapshot> {
  if (poll.resultsSnapshot) return poll.resultsSnapshot as ResultsSnapshot;
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(pollTable).where(eq(pollTable.id, poll.id)).for("update");
    if (!current) throw new DomainError("not_found");
    if (current.resultsSnapshot) return current.resultsSnapshot as ResultsSnapshot;
    const snapshot = await countPoll(tx, current, now);
    await tx
      .update(pollTable)
      .set({ resultsSnapshot: snapshot, cvrSha256: snapshot.results.cvrSha256 })
      .where(and(eq(pollTable.id, poll.id), isNull(pollTable.resultsSnapshot)));
    return snapshot;
  });
}
