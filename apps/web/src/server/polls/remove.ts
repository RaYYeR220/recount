import { eq } from "drizzle-orm";
import { recordAudit } from "../audit";
import { findOwnedPoll } from "../authz";
import type { Db } from "../db/client";
import { poll } from "../db/schema";

/** Options, codes and ballots go with the poll; its audit trail stays. */
export async function deletePoll(db: Db, actorId: string, slug: string, now: Date): Promise<void> {
  await db.transaction(async (tx) => {
    const current = await findOwnedPoll(tx, actorId, slug, { lock: true });
    await recordAudit(tx, current.id, "poll.deleted", actorId, now, { slug: current.slug });
    await tx.delete(poll).where(eq(poll.id, current.id));
  });
}
