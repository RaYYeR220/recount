import type { Db } from "../db/client";
import { createPoll } from "./create";
import type { PollDetail } from "./detail";
import type { CreatePollInput } from "./schema";

class Rollback {
  constructor(readonly detail: PollDetail) {}
}

/**
 * What createPoll would return for this input, with nothing kept: it runs inside a
 * transaction that is always rolled back. The wizard's review shows the same
 * validation errors and DST warnings that creating the poll gives.
 */
export async function previewPoll(
  db: Db,
  ownerId: string,
  input: CreatePollInput,
  now: Date,
): Promise<PollDetail> {
  try {
    await db.transaction(async (tx) => {
      throw new Rollback(await createPoll(tx, ownerId, input, now));
    });
  } catch (outcome) {
    if (outcome instanceof Rollback) return outcome.detail;
    throw outcome;
  }
  throw new Error("previewPoll: the transaction was not rolled back");
}
