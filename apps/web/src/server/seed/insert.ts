import { eq } from "drizzle-orm";
import { recordAudit } from "../audit";
import type { Db } from "../db/client";
import { ballot, inviteCode, poll, pollOption } from "../db/schema";
import { ID_ALPHABET } from "../ids";
import { ballotShapeIssues, type PresetId } from "../polls/schema";
import { pollStatus } from "../polls/status";
import { countPoll } from "../results/snapshot";
import { seededString } from "./random";

export type SeedPoll = {
  slug: string;
  owner: "ada" | "rival";
  title: string;
  description?: string;
  options: string[];
  seats: number;
  presetId: PresetId;
  maxRanks: number | null;
  accessMode: "link" | "codes";
  resultsVisibility: "live" | "after_close" | "owner_only";
  timeZone: string;
  createdAt: Date;
  opensAt: Date;
  closesAt: Date | null;
  closedEarlyAt?: Date;
  /** Option labels, most preferred first. */
  ballots: string[][];
  unusedCodes?: number;
};

const MINUTE = 60_000;

export function seedReceipt(slug: string, index: number): string {
  return seededString(`${slug}:ballot:${index}`, 12, ID_ALPHABET);
}

export function seedCode(slug: string, index: number): string {
  const raw = seededString(`${slug}:code:${index}`, 8, ID_ALPHABET.toUpperCase());
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

/** Inserts the poll with its ballots, codes and snapshot; a slug that already exists is left alone. */
export async function insertSeedPoll(db: Db, ownerId: string, spec: SeedPoll, now: Date): Promise<boolean> {
  const issues = ballotShapeIssues(spec);
  if (issues.length > 0) throw new Error(`seed poll ${spec.slug}: ${issues.map((i) => i.message).join("; ")}`);

  return db.transaction(async (tx) => {
    const [existing] = await tx.select({ id: poll.id }).from(poll).where(eq(poll.slug, spec.slug));
    if (existing) return false;

    const [row] = await tx
      .insert(poll)
      .values({
        slug: spec.slug,
        ownerId,
        title: spec.title,
        description: spec.description ?? "",
        seats: spec.seats,
        presetId: spec.presetId,
        maxRanks: spec.maxRanks,
        accessMode: spec.accessMode,
        resultsVisibility: spec.resultsVisibility,
        timeZone: spec.timeZone,
        opensAt: spec.opensAt,
        closesAt: spec.closesAt,
        closedEarlyAt: spec.closedEarlyAt ?? null,
        createdAt: spec.createdAt,
        updatedAt: spec.closedEarlyAt ?? spec.createdAt,
      })
      .returning();
    const options = await tx
      .insert(pollOption)
      .values(spec.options.map((label, position) => ({ pollId: row.id, label, position })))
      .returning();
    const idOf = new Map(options.map((o) => [o.label, o.id]));
    const castAt = (i: number) => new Date(spec.opensAt.getTime() + (i + 1) * MINUTE);

    const stored = spec.ballots.length
      ? await tx
          .insert(ballot)
          .values(
            spec.ballots.map((ranking, i) => ({
              pollId: row.id,
              ranking: ranking.map((label) => {
                const id = idOf.get(label);
                if (!id) throw new Error(`seed poll ${spec.slug}: unknown option ${label}`);
                return id;
              }),
              receipt: seedReceipt(spec.slug, i),
              createdAt: castAt(i),
            })),
          )
          .returning({ id: ballot.id })
      : [];

    await recordAudit(tx, row.id, "poll.created", ownerId, spec.createdAt);
    if (spec.accessMode === "codes") {
      const total = stored.length + (spec.unusedCodes ?? 0);
      const codes = Array.from({ length: total }, (_, i) => ({
        pollId: row.id,
        code: seedCode(spec.slug, i),
        usedAt: i < stored.length ? castAt(i) : null,
        ballotId: i < stored.length ? stored[i].id : null,
        createdAt: spec.createdAt,
      }));
      if (codes.length > 0) {
        await tx.insert(inviteCode).values(codes);
        const generatedAt = new Date(spec.createdAt.getTime() + MINUTE);
        await recordAudit(tx, row.id, "codes.generated", ownerId, generatedAt, { count: codes.length });
      }
    }
    if (spec.closedEarlyAt) await recordAudit(tx, row.id, "poll.closed", ownerId, spec.closedEarlyAt);

    if (pollStatus(row, now) === "closed") {
      const snapshot = await countPoll(tx, row, now);
      await tx
        .update(poll)
        .set({ resultsSnapshot: snapshot, cvrSha256: snapshot.results.cvrSha256 })
        .where(eq(poll.id, row.id));
    }
    return true;
  });
}
