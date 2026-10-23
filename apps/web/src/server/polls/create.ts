import { recordAudit } from "../audit";
import type { Db } from "../db/client";
import { poll, pollOption } from "../db/schema";
import { newSlug } from "../ids";
import { parseOrThrow } from "../validation";
import { toPollDetail, type PollDetail } from "./detail";
import { assertSchedule, toInstant, type ScheduleWarning } from "./schedule";
import { createPollSchema, type CreatePollInput } from "./schema";

export async function createPoll(
  db: Db,
  ownerId: string,
  input: CreatePollInput,
  now: Date,
): Promise<PollDetail> {
  const data = parseOrThrow(createPollSchema, input);
  const warnings: ScheduleWarning[] = [];
  const opensAt = data.opensAtLocal
    ? toInstant("opensAt", data.opensAtLocal, data.timeZone, warnings)
    : now;
  const closesAt = data.closesAtLocal
    ? toInstant("closesAt", data.closesAtLocal, data.timeZone, warnings)
    : null;
  assertSchedule(opensAt, closesAt, now, { openingSet: Boolean(data.opensAtLocal) });

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(poll)
      .values({
        slug: newSlug(),
        ownerId,
        title: data.title,
        description: data.description ?? "",
        seats: data.seats,
        presetId: data.presetId,
        maxRanks: data.maxRanks,
        accessMode: data.accessMode,
        resultsVisibility: data.resultsVisibility,
        timeZone: data.timeZone,
        opensAt,
        closesAt,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    const options = await tx
      .insert(pollOption)
      .values(data.options.map((label, position) => ({ pollId: row.id, label, position })))
      .returning({ id: pollOption.id, label: pollOption.label, position: pollOption.position });
    await recordAudit(tx, row.id, "poll.created", ownerId, now);
    return toPollDetail(row, options, 0, now, warnings);
  });
}
