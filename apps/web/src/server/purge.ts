import { and, ilike, inArray, lt, or } from "drizzle-orm";
import type { Db } from "./db/client";
import { auditEvent, poll, rateLimit, user } from "./db/schema";

/** Accounts made by test runs; real users never sign up with these. */
export const TEST_EMAIL_DOMAINS = ["example.com", "test.recount.dev"];

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Deletes test accounts older than a day, with their polls, ballots, codes and audit trails. */
export async function purgeTestData(db: Db, now: Date): Promise<{ users: number; polls: number }> {
  const cutoff = new Date(now.getTime() - MAX_AGE_MS);
  return db.transaction(async (tx) => {
    const doomed = await tx
      .select({ id: user.id })
      .from(user)
      .where(
        and(
          or(...TEST_EMAIL_DOMAINS.map((domain) => ilike(user.email, `%@${domain}`))),
          lt(user.createdAt, cutoff),
        ),
      );
    if (doomed.length === 0) return { users: 0, polls: 0 };

    const userIds = doomed.map((u) => u.id);
    const polls = await tx.select({ id: poll.id }).from(poll).where(inArray(poll.ownerId, userIds));
    if (polls.length > 0) {
      await tx.delete(auditEvent).where(inArray(auditEvent.pollId, polls.map((p) => p.id)));
    }
    await tx.delete(user).where(inArray(user.id, userIds));
    return { users: userIds.length, polls: polls.length };
  });
}

/** Rate-limit windows are a minute to a quarter of an hour; a day-old row only takes space. */
export async function purgeRateLimits(db: Db, now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - MAX_AGE_MS);
  const gone = await db.delete(rateLimit).where(lt(rateLimit.windowStart, cutoff)).returning({ key: rateLimit.key });
  return gone.length;
}
