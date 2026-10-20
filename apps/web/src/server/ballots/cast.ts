import { createHash } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { ballot, inviteCode, poll } from "../db/schema";
import { DomainError } from "../errors";
import { normalizeInviteCode } from "../polls/codes";
import { loadOptions } from "../polls/detail";
import { closedSince, pollStatus } from "../polls/status";
import { validationError } from "../validation";
import { formatReceipt, newReceipt } from "./receipt";

export type CastInput = {
  slug: string;
  ranking: string[];
  code?: string;
  voterToken: string;
};

export function hashVoterToken(pollId: string, voterToken: string): string {
  return createHash("sha256").update(`${pollId}:${voterToken}`).digest("hex");
}

function assertRanking(ranking: string[], optionIds: Set<string>, maxRanks: number | null): void {
  const fail = (message: string) => validationError({ path: "ranking", message });
  if (ranking.length === 0) throw fail("Rank at least one option");
  if (new Set(ranking).size !== ranking.length) throw fail("Each option can be ranked only once");
  if (!ranking.every((id) => optionIds.has(id))) throw fail("The ranking includes an unknown option");
  if (maxRanks !== null && ranking.length > maxRanks) throw fail(`Rank at most ${maxRanks} options`);
}

async function claimCode(tx: Db, pollId: string, code: string, now: Date): Promise<string> {
  const [claimed] = await tx
    .update(inviteCode)
    .set({ usedAt: now })
    .where(and(eq(inviteCode.pollId, pollId), eq(inviteCode.code, code), isNull(inviteCode.usedAt)))
    .returning({ id: inviteCode.id });
  if (claimed) return claimed.id;

  const [known] = await tx
    .select({ id: inviteCode.id })
    .from(inviteCode)
    .where(and(eq(inviteCode.pollId, pollId), eq(inviteCode.code, code)));
  throw new DomainError(known ? "code_used" : "code_invalid");
}

/**
 * The poll row is share-locked for the whole cast, so closing the poll or
 * editing its options waits for in-flight ballots, and a ballot that started
 * after such an edit sees the edited options.
 */
export async function castBallot(db: Db, input: CastInput, now: Date): Promise<{ receipt: string }> {
  return db.transaction(async (tx) => {
    const [target] = await tx.select().from(poll).where(eq(poll.slug, input.slug)).for("share");
    if (!target) throw new DomainError("not_found");

    const status = pollStatus(target, now);
    if (status === "scheduled") throw new DomainError("poll_not_open");
    if (status === "closed") throw new DomainError("poll_closed", { closedAt: closedSince(target, now) });

    const usesCodes = target.accessMode === "codes";
    const typedCode = input.code?.trim() ?? "";
    if (usesCodes && typedCode === "") throw new DomainError("code_required");
    if (!usesCodes && input.voterToken === "") {
      throw validationError({ path: "voterToken", message: "Missing voter token" });
    }

    const options = await loadOptions(tx, target.id);
    assertRanking(input.ranking, new Set(options.map((o) => o.id)), target.maxRanks);

    let codeId: string | null = null;
    if (usesCodes) {
      const code = normalizeInviteCode(typedCode);
      if (!code) throw new DomainError("code_invalid");
      codeId = await claimCode(tx, target.id, code, now);
    }

    const receipt = newReceipt();
    const [stored] = await tx
      .insert(ballot)
      .values({
        pollId: target.id,
        ranking: input.ranking,
        receipt,
        voterTokenHash: usesCodes ? null : hashVoterToken(target.id, input.voterToken),
        createdAt: now,
      })
      .onConflictDoNothing({
        target: [ballot.pollId, ballot.voterTokenHash],
        where: sql`${ballot.voterTokenHash} is not null`,
      })
      .returning({ id: ballot.id });
    if (!stored) throw new DomainError("already_voted");

    if (codeId) {
      await tx.update(inviteCode).set({ ballotId: stored.id }).where(eq(inviteCode.id, codeId));
    }
    return { receipt: formatReceipt(receipt) };
  });
}
