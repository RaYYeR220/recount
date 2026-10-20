import { and, eq } from "drizzle-orm";
import { findPoll } from "../authz";
import type { Db } from "../db/client";
import { inviteCode } from "../db/schema";
import { DomainError } from "../errors";
import { normalizeInviteCode } from "../polls/codes";
import { closedSince, pollStatus } from "../polls/status";

/**
 * Checks an invite code before the voter ranks, without using it up: castBallot
 * claims it, so a code checked here can still be taken by someone faster. Throws
 * the same errors castBallot would; returns the code in its canonical form.
 */
export async function checkInviteCode(db: Db, slug: string, input: string, now: Date): Promise<string> {
  const target = await findPoll(db, slug);
  const status = pollStatus(target, now);
  if (status === "scheduled") throw new DomainError("poll_not_open");
  if (status === "closed") throw new DomainError("poll_closed", { closedAt: closedSince(target, now) });
  if (input.trim() === "") throw new DomainError("code_required");

  const code = normalizeInviteCode(input);
  if (!code) throw new DomainError("code_invalid");
  const [row] = await db
    .select({ usedAt: inviteCode.usedAt })
    .from(inviteCode)
    .where(and(eq(inviteCode.pollId, target.id), eq(inviteCode.code, code)));
  if (!row) throw new DomainError("code_invalid");
  if (row.usedAt) throw new DomainError("code_used");
  return code;
}
