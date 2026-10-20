import { eq } from "drizzle-orm";
import { recordAudit } from "../audit";
import { findOwnedPoll } from "../authz";
import type { Db } from "../db/client";
import { poll } from "../db/schema";
import { countPoll } from "../results/snapshot";
import { loadPollDetail, type PollDetail } from "./detail";
import { pollStatus } from "./status";

/** Closing freezes the count: the results and the CVR hash are stored with the poll. */
export async function closePoll(
  db: Db,
  actorId: string,
  slug: string,
  now: Date,
): Promise<PollDetail> {
  return db.transaction(async (tx) => {
    const current = await findOwnedPoll(tx, actorId, slug, { lock: true });
    if (pollStatus(current, now) === "closed") return loadPollDetail(tx, current, now);

    const snapshot = await countPoll(tx, { ...current, closedEarlyAt: now }, now);
    const [row] = await tx
      .update(poll)
      .set({
        closedEarlyAt: now,
        updatedAt: now,
        resultsSnapshot: snapshot,
        cvrSha256: snapshot.results.cvrSha256,
      })
      .where(eq(poll.id, current.id))
      .returning();
    await recordAudit(tx, row.id, "poll.closed", actorId, now, { cvrSha256: snapshot.results.cvrSha256 });
    return loadPollDetail(tx, row, now);
  });
}
