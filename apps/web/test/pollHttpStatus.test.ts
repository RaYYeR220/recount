import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/client";
import { createPoll } from "@/server/polls/create";
import { managePageStatus, voterPageStatus } from "@/server/polls/httpStatus";
import { createTestDb } from "./db";
import { T0, createUser, pollInput } from "./factories";

describe("poll page statuses", () => {
  let db: Db;
  let ownerId: string;
  let strangerId: string;
  let slug: string;

  beforeAll(async () => {
    db = await createTestDb();
    ownerId = (await createUser(db, "Ada")).id;
    strangerId = (await createUser(db, "Rival")).id;
    ({ slug } = await createPoll(db, ownerId, pollInput({ resultsVisibility: "owner_only" }), T0));
  });

  it("serves the voter page of any poll that exists, private results or not", async () => {
    expect(await voterPageStatus(db, slug)).toBe(200);
    expect(await voterPageStatus(db, "no-such-poll")).toBe(404);
  });

  it("answers 404 for a slug no poll could have, without asking the database", async () => {
    for (const slug of ["\u0000", "%00", "Offsite 2026", "a".repeat(65), ""]) {
      expect(await voterPageStatus(db, slug)).toBe(404);
      expect(await managePageStatus(db, ownerId, slug)).toBe(404);
    }
  });

  it("serves the manage page to its owner only; anyone else gets the same 404 as no poll", async () => {
    expect(await managePageStatus(db, ownerId, slug)).toBe(200);
    expect(await managePageStatus(db, strangerId, slug)).toBe(404);
    expect(await managePageStatus(db, ownerId, "no-such-poll")).toBe(404);
  });
});
