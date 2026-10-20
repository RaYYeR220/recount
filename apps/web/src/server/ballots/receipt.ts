import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { ballot, poll } from "../db/schema";
import { DomainError } from "../errors";
import { ID_ALPHABET, randomString } from "../ids";
import { loadOptions } from "../polls/detail";

const RECEIPT_SHAPE = new RegExp(`^[${ID_ALPHABET}]{12}$`);

export function newReceipt(): string {
  return randomString(12);
}

export function formatReceipt(raw: string): string {
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
}

export function normalizeReceipt(input: string): string {
  return input.toLowerCase().replace(/[\s-]/g, "");
}

export async function lookupReceipt(
  db: Db,
  slug: string,
  receipt: string,
): Promise<{ castAt: Date; ranking: string[] }> {
  const normalized = normalizeReceipt(receipt);
  if (!RECEIPT_SHAPE.test(normalized)) throw new DomainError("not_found");

  const [row] = await db
    .select({ pollId: ballot.pollId, ranking: ballot.ranking, castAt: ballot.createdAt })
    .from(ballot)
    .innerJoin(poll, eq(poll.id, ballot.pollId))
    .where(and(eq(poll.slug, slug), eq(ballot.receipt, normalized)));
  if (!row) throw new DomainError("not_found");

  const labels = new Map((await loadOptions(db, row.pollId)).map((o) => [o.id, o.label]));
  return { castAt: row.castAt, ranking: row.ranking.map((id) => labels.get(id) ?? "") };
}
