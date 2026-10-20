import { randomUUID } from "node:crypto";
import type { Db } from "@/server/db/client";
import { ballot, user } from "@/server/db/schema";
import { DomainError } from "@/server/errors";
import type { CreatePollInput } from "@/server/polls/schema";

export async function rejectionOf(promise: Promise<unknown>): Promise<DomainError> {
  const error = await promise.then(() => null, (e: unknown) => e);
  if (!(error instanceof DomainError)) throw new Error(`expected a DomainError, got ${String(error)}`);
  return error;
}

export async function errorCode(promise: Promise<unknown>): Promise<string> {
  return (await rejectionOf(promise)).code;
}

export const T0 = new Date("2026-10-19T12:00:00Z");

export function minutesAfter(minutes: number, from: Date = T0): Date {
  return new Date(from.getTime() + minutes * 60_000);
}

export async function createUser(db: Db, name = "Ada"): Promise<{ id: string; email: string }> {
  const id = randomUUID();
  const email = `${name.toLowerCase()}-${id.slice(0, 8)}@example.com`;
  await db.insert(user).values({ id, name, email });
  return { id, email };
}

export function pollInput(overrides: Partial<CreatePollInput> = {}): CreatePollInput {
  return {
    title: "Team lunch",
    options: ["Pizza", "Tacos", "Sushi"],
    seats: 1,
    presetId: "recount-standard",
    maxRanks: null,
    accessMode: "link",
    resultsVisibility: "live",
    timeZone: "UTC",
    opensAtLocal: null,
    closesAtLocal: null,
    ...overrides,
  };
}

export async function insertBallot(db: Db, pollId: string, ranking: string[], createdAt = T0) {
  const [row] = await db
    .insert(ballot)
    .values({ pollId, ranking, receipt: randomUUID().replace(/-/g, "").slice(0, 12), createdAt })
    .returning();
  return row;
}
