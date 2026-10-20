import { eq } from "drizzle-orm";
import { recordAudit } from "../audit";
import { findOwnedPoll } from "../authz";
import type { Db } from "../db/client";
import { poll, pollOption } from "../db/schema";
import { DomainError } from "../errors";
import { parseOrThrow, validationError } from "../validation";
import { countBallots, loadOptions, loadPollDetail, type PollDetail } from "./detail";
import { assertSchedule, toInstant, type ScheduleWarning } from "./schedule";
import {
  ballotShapeIssues,
  updatePollSchema,
  type PresetId,
  type UpdatePollInput,
} from "./schema";
import { pollStatus } from "./status";

const BALLOT_FIELDS = ["options", "seats", "presetId", "maxRanks", "accessMode"];

function same(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return a === b;
}

export async function updatePoll(
  db: Db,
  actorId: string,
  slug: string,
  patch: UpdatePollInput,
  now: Date,
): Promise<PollDetail> {
  const data = parseOrThrow(updatePollSchema, patch);

  return db.transaction(async (tx) => {
    const current = await findOwnedPoll(tx, actorId, slug, { lock: true });
    const currentLabels = (await loadOptions(tx, current.id)).map((o) => o.label);
    const warnings: ScheduleWarning[] = [];
    const timeZone = data.timeZone ?? current.timeZone;

    const next = {
      title: data.title ?? current.title,
      description: data.description ?? current.description,
      seats: data.seats ?? current.seats,
      presetId: data.presetId ?? current.presetId,
      maxRanks: data.maxRanks === undefined ? current.maxRanks : data.maxRanks,
      accessMode: data.accessMode ?? current.accessMode,
      resultsVisibility: data.resultsVisibility ?? current.resultsVisibility,
      timeZone,
      opensAt:
        data.opensAtLocal === undefined
          ? current.opensAt
          : data.opensAtLocal === null
            ? now
            : toInstant("opensAt", data.opensAtLocal, timeZone, warnings),
      closesAt:
        data.closesAtLocal === undefined
          ? current.closesAt
          : data.closesAtLocal === null
            ? null
            : toInstant("closesAt", data.closesAtLocal, timeZone, warnings),
    };
    const labels = data.options ?? currentLabels;

    const changed: string[] = (Object.keys(next) as (keyof typeof next)[]).filter(
      (key) => !same(next[key], current[key]),
    );
    if (labels.join("\n") !== currentLabels.join("\n")) changed.push("options");
    if (changed.length === 0) return loadPollDetail(tx, current, now);

    const lockedFields = changed.filter((field) => BALLOT_FIELDS.includes(field));
    if (lockedFields.length > 0 && (await countBallots(tx, current.id)) > 0) {
      throw new DomainError("options_locked", { fields: lockedFields });
    }
    const status = pollStatus(current, now);
    if (changed.includes("opensAt") && status !== "scheduled") {
      throw new DomainError("schedule_locked", { field: "opensAt" });
    }
    if (changed.includes("closesAt") && status === "closed") {
      throw new DomainError("schedule_locked", { field: "closesAt" });
    }

    if (lockedFields.length > 0) {
      const issues = ballotShapeIssues({
        options: labels,
        seats: next.seats,
        presetId: next.presetId as PresetId,
        maxRanks: next.maxRanks,
      });
      if (issues.length > 0) throw validationError(...issues);
    }
    if (changed.includes("opensAt") || changed.includes("closesAt")) {
      assertSchedule(next.opensAt ?? current.createdAt, next.closesAt, now);
    }

    const [row] = await tx
      .update(poll)
      .set({ ...next, updatedAt: now })
      .where(eq(poll.id, current.id))
      .returning();
    if (changed.includes("options")) {
      await tx.delete(pollOption).where(eq(pollOption.pollId, current.id));
      await tx
        .insert(pollOption)
        .values(labels.map((label, position) => ({ pollId: current.id, label, position })));
    }
    await recordAudit(tx, current.id, "poll.updated", actorId, now, { fields: changed });
    return loadPollDetail(tx, row, now, warnings);
  });
}
