import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/client";
import { auditEvent, ballot, poll, pollOption, rateLimit, user } from "@/server/db/schema";
import { createTestDb } from "./db";

const now = new Date("2026-10-19T12:00:00Z");

async function seedPoll(db: Db) {
  const userId = randomUUID();
  await db.insert(user).values({ id: userId, name: "Ada", email: `${userId}@example.com` });
  const [row] = await db
    .insert(poll)
    .values({
      slug: userId.slice(0, 10),
      ownerId: userId,
      title: "Lunch",
      presetId: "recount-standard",
      accessMode: "link",
      resultsVisibility: "live",
      timeZone: "UTC",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  const options = await db
    .insert(pollOption)
    .values([
      { pollId: row.id, label: "Pizza", position: 0 },
      { pollId: row.id, label: "Tacos", position: 1 },
    ])
    .returning();
  return { poll: row, options };
}

function sqlState(error: unknown): string | undefined {
  let current: unknown = error;
  while (current instanceof Error) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string") return code;
    current = current.cause;
  }
  return undefined;
}

describe("schema", () => {
  let db: Db;

  beforeAll(async () => {
    db = await createTestDb();
  });

  it("applies every migration", async () => {
    await expect(db.select().from(rateLimit)).resolves.toEqual([]);
    await expect(db.select().from(auditEvent)).resolves.toEqual([]);
  });

  it("rejects a second ballot with the same voter token in one poll", async () => {
    const { poll: p, options } = await seedPoll(db);
    const values = {
      pollId: p.id,
      ranking: options.map((o) => o.id),
      voterTokenHash: "same-voter",
      createdAt: now,
    };
    await db.insert(ballot).values({ ...values, receipt: "aaaaaaaaaaaa" });

    const second = db.insert(ballot).values({ ...values, receipt: "bbbbbbbbbbbb" });
    const error = await second.then(() => null, (e: unknown) => e);
    expect(sqlState(error)).toBe("23505");
  });

  it("allows any number of ballots without a voter token", async () => {
    const { poll: p, options } = await seedPoll(db);
    const values = { pollId: p.id, ranking: [options[1].id], voterTokenHash: null, createdAt: now };
    await db.insert(ballot).values({ ...values, receipt: "cccccccccccc" });
    await db.insert(ballot).values({ ...values, receipt: "dddddddddddd" });

    const rows = await db.select().from(ballot).where(eq(ballot.pollId, p.id));
    expect(rows).toHaveLength(2);
    expect(rows[0].ranking).toEqual([options[1].id]);
  });
});
