import { eq } from "drizzle-orm";
import { recordAudit } from "../audit";
import { findOwnedPoll } from "../authz";
import type { Db } from "../db/client";
import { poll } from "../db/schema";
import { loadPollDetail, type PollDetail } from "./detail";
import { pollStatus } from "./status";

export async function closePoll(
  db: Db,
  actorId: string,
  slug: string,
  now: Date,
): Promise<PollDetail> {
  return db.transaction(async (tx) => {
    const current = await findOwnedPoll(tx, actorId, slug, { lock: true });
    if (pollStatus(current, now) === "closed") return loadPollDetail(tx, current, now);

    const [row] = await tx
      .update(poll)
      .set({ closedEarlyAt: now, updatedAt: now })
      .where(eq(poll.id, current.id))
      .returning();
    await recordAudit(tx, row.id, "poll.closed", actorId, now);
    return loadPollDetail(tx, row, now);
  });
}
