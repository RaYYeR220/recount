import { and, eq } from "drizzle-orm";
import type { Db } from "./db/client";
import { poll } from "./db/schema";
import { DomainError } from "./errors";
import type { PollRow } from "./polls/detail";

/** Generated slugs and the seeded ones are lowercase letters, digits and dashes. */
export const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Anything that can't be a slug is a poll that doesn't exist; it never reaches a query. */
export function assertSlugShape(slug: string): void {
  if (!SLUG.test(slug)) throw new DomainError("not_found");
}

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
  assertSlugShape(slug);
  const query = db
    .select()
    .from(poll)
    .where(and(eq(poll.slug, slug), eq(poll.ownerId, actorId)));
  const [row] = options.lock ? await query.for("update") : await query;
  if (!row) throw new DomainError("not_found");
  return row;
}

export async function findPoll(db: Db, slug: string): Promise<PollRow> {
  assertSlugShape(slug);
  const [row] = await db.select().from(poll).where(eq(poll.slug, slug));
  if (!row) throw new DomainError("not_found");
  return row;
}
