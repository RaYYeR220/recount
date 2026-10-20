import { asc, eq } from "drizzle-orm";
import { recordAudit } from "../audit";
import { findOwnedPoll } from "../authz";
import type { Db } from "../db/client";
import { inviteCode } from "../db/schema";
import { DomainError } from "../errors";
import { ID_ALPHABET, randomString } from "../ids";
import { validationError } from "../validation";
import { pollStatus } from "./status";

export const MAX_CODES_PER_REQUEST = 500;
export const MAX_CODES_PER_POLL = 5_000;

const CODE_ALPHABET = ID_ALPHABET.toUpperCase();
const CODE_SHAPE = new RegExp(`^[${CODE_ALPHABET}]{8}$`);

function newInviteCode(): string {
  const raw = randomString(8, CODE_ALPHABET);
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

/** Accepts any casing, spacing or dashes; null when it cannot be a code at all. */
export function normalizeInviteCode(input: string): string | null {
  const raw = input.toUpperCase().replace(/[\s-]/g, "");
  return CODE_SHAPE.test(raw) ? `${raw.slice(0, 4)}-${raw.slice(4)}` : null;
}

export async function generateInviteCodes(
  db: Db,
  actorId: string,
  slug: string,
  count: number,
  now: Date,
): Promise<{ created: number; codes: string[] }> {
  if (!Number.isInteger(count) || count < 1 || count > MAX_CODES_PER_REQUEST) {
    throw validationError({ path: "count", message: `Generate between 1 and ${MAX_CODES_PER_REQUEST} codes at a time` });
  }

  return db.transaction(async (tx) => {
    const poll = await findOwnedPoll(tx, actorId, slug, { lock: true });
    if (poll.accessMode !== "codes") {
      throw validationError({ path: "accessMode", message: "Switch the poll to invite codes first" });
    }
    if (pollStatus(poll, now) === "closed") throw new DomainError("poll_closed");

    const existing = await tx.$count(inviteCode, eq(inviteCode.pollId, poll.id));
    if (existing + count > MAX_CODES_PER_POLL) {
      throw validationError({
        path: "count",
        message: `A poll can have at most ${MAX_CODES_PER_POLL} codes; this one has ${existing}`,
      });
    }

    const codes: string[] = [];
    while (codes.length < count) {
      const batch = new Set(Array.from({ length: count - codes.length }, newInviteCode));
      const inserted = await tx
        .insert(inviteCode)
        .values([...batch].map((code) => ({ pollId: poll.id, code, createdAt: now })))
        .onConflictDoNothing()
        .returning({ code: inviteCode.code });
      codes.push(...inserted.map((row) => row.code));
    }

    await recordAudit(tx, poll.id, "codes.generated", actorId, now, { count });
    return { created: codes.length, codes };
  });
}

export async function listInviteCodes(
  db: Db,
  actorId: string,
  slug: string,
): Promise<Array<{ code: string; usedAt: Date | null }>> {
  const poll = await findOwnedPoll(db, actorId, slug);
  return db
    .select({ code: inviteCode.code, usedAt: inviteCode.usedAt })
    .from(inviteCode)
    .where(eq(inviteCode.pollId, poll.id))
    .orderBy(asc(inviteCode.createdAt), asc(inviteCode.code));
}
