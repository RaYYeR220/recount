import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { findPoll } from "../authz";
import type { Db } from "../db/client";
import { ballot } from "../db/schema";
import { DomainError } from "../errors";
import { loadOptions, type PollRow } from "../polls/detail";
import { pollStatus } from "../polls/status";
import { canSeeResults } from "./visibility";

export type Cvr = {
  /** Option labels in ballot order; candidates nobody ranked are still listed. */
  labels: string[];
  header: string[];
  rows: string[][];
  csv: string;
  sha256: string;
};

function csvField(value: string): string {
  return /[",\r\n]|^\s|\s$/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(header: string[], rows: string[][]): string {
  return [header, ...rows].map((row) => `${row.map(csvField).join(",")}\n`).join("");
}

/**
 * One row per ballot, ordered by receipt so its position is reproducible without
 * publishing receipts. The hash covers the CSV bytes exactly as served.
 */
export function buildCvr(
  options: Array<{ id: string; label: string }>,
  ballots: Array<{ ranking: string[] }>,
  maxRanks: number | null,
): Cvr {
  const labelOf = new Map(options.map((o) => [o.id, o.label]));
  const width = maxRanks ?? options.length;
  const header = Array.from({ length: width }, (_, i) => `Rank ${i + 1}`);
  const rows = ballots.map(({ ranking }) =>
    Array.from({ length: width }, (_, i) => (i < ranking.length ? (labelOf.get(ranking[i]) ?? "") : "")),
  );
  const csv = toCsv(header, rows);
  return {
    labels: options.map((o) => o.label),
    header,
    rows,
    csv,
    sha256: createHash("sha256").update(csv, "utf8").digest("hex"),
  };
}

export async function loadCvr(db: Db, poll: Pick<PollRow, "id" | "maxRanks">): Promise<Cvr> {
  const options = await loadOptions(db, poll.id);
  const ballots = await db
    .select({ ranking: ballot.ranking, receipt: ballot.receipt })
    .from(ballot)
    .where(eq(ballot.pollId, poll.id));
  ballots.sort((a, b) => (a.receipt < b.receipt ? -1 : 1));
  return buildCvr(options, ballots, poll.maxRanks);
}

export async function getCvr(
  db: Db,
  viewerId: string | null,
  slug: string,
  now: Date,
): Promise<Pick<Cvr, "header" | "rows" | "sha256" | "csv">> {
  const poll = await findPoll(db, slug);
  if (canSeeResults(poll, viewerId, now) === "not_found") throw new DomainError("not_found");
  if (pollStatus(poll, now) !== "closed") throw new DomainError("cvr_not_published");
  const { header, rows, sha256, csv } = await loadCvr(db, poll);
  return { header, rows, sha256, csv };
}
