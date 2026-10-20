import { and, eq } from "drizzle-orm";
import type { Db } from "./db/client";
import { poll } from "./db/schema";
import { DomainError } from "./errors";
import type { PollRow } from "./polls/detail";

/**
 * Someone else's poll and a slug that does not exist look the same from the
 * outside: both are `not_found`.
 */
export async function findOwnedPoll(
  db: Db,
  actorId: string | null,
  slug: string,
  options: { lock?: boolean } = {},
): Promise<PollRow> {
  if (!actorId) throw new DomainError("not_found");
  const query = db
    .select()
    .from(poll)
    .where(and(eq(poll.slug, slug), eq(poll.ownerId, actorId)));
  const [row] = options.lock ? await query.for("update") : await query;
  if (!row) throw new DomainError("not_found");
  return row;
}

export async function findPoll(db: Db, slug: string): Promise<PollRow> {
  const [row] = await db.select().from(poll).where(eq(poll.slug, slug));
  if (!row) throw new DomainError("not_found");
  return row;
}
