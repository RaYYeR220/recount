import { eq, sql } from "drizzle-orm";
import type { Db } from "./db/client";
import { rateLimit } from "./db/schema";
import { DomainError } from "./errors";

export const LIMITS = {
  castBallot: { limit: 20, windowSeconds: 60 },
  receiptLookup: { limit: 30, windowSeconds: 60 },
  emailSignIn: { limit: 10, windowSeconds: 15 * 60 },
  signInIp: { limit: 60, windowSeconds: 60 },
  signUpIp: { limit: 30, windowSeconds: 60 },
  tabulate: { limit: 30, windowSeconds: 60 },
} as const;

/**
 * A window opens at the first hit for a key and lasts `windowSeconds`; hits
 * are counted atomically, so concurrent callers never both slip under the limit.
 */
export async function checkRateLimit(
  db: Db,
  key: string,
  limit: number,
  windowSeconds: number,
  now: Date,
): Promise<void> {
  const windowOpen = sql`${rateLimit.windowStart} > ${new Date(now.getTime() - windowSeconds * 1000).toISOString()}::timestamptz`;
  const [row] = await db
    .insert(rateLimit)
    .values({ key, windowStart: now, count: 1 })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: {
        count: sql`case when ${windowOpen} then ${rateLimit.count} + 1 else 1 end`,
        windowStart: sql`case when ${windowOpen} then ${rateLimit.windowStart} else excluded.window_start end`,
      },
    })
    .returning({ count: rateLimit.count, windowStart: rateLimit.windowStart });

  if (row.count > limit) {
    const endsAt = row.windowStart.getTime() + windowSeconds * 1000;
    throw new DomainError("rate_limited", {
      retryAfterSeconds: Math.max(1, Math.ceil((endsAt - now.getTime()) / 1000)),
    });
  }
}

export async function clearRateLimit(db: Db, key: string): Promise<void> {
  await db.delete(rateLimit).where(eq(rateLimit.key, key));
}
