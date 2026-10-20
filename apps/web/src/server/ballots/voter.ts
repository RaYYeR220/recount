import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { ballot, poll } from "../db/schema";
import { hashVoterToken } from "./cast";
import { formatReceipt } from "./receipt";

/**
 * The ballot this browser's voter token cast in a link-mode poll, or null. Code-mode
 * ballots carry no token, so they are never found here.
 */
export async function findVoterBallot(
  db: Db,
  slug: string,
  voterToken: string,
): Promise<{ receipt: string; castAt: Date } | null> {
  if (voterToken === "") return null;
  const [target] = await db.select({ id: poll.id }).from(poll).where(eq(poll.slug, slug));
  if (!target) return null;
  const [row] = await db
    .select({ receipt: ballot.receipt, castAt: ballot.createdAt })
    .from(ballot)
    .where(and(eq(ballot.pollId, target.id), eq(ballot.voterTokenHash, hashVoterToken(target.id, voterToken))));
  return row ? { receipt: formatReceipt(row.receipt), castAt: row.castAt } : null;
}
