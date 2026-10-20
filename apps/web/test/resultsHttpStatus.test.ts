import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/client";
import { createPoll } from "@/server/polls/create";
import { resultsHttpStatus } from "@/server/results/httpStatus";
import { createTestDb } from "./db";
import { T0, createUser, minutesAfter, pollInput } from "./factories";

describe("resultsHttpStatus", () => {
  let db: Db;
  let ownerId: string;
  let strangerId: string;
  const open = minutesAfter(30);
  const afterClose = minutesAfter(60 * 24 * 30);

  beforeAll(async () => {
    db = await createTestDb();
    ownerId = (await createUser(db, "Ada")).id;
    strangerId = (await createUser(db, "Rival")).id;
  });

  async function poll(resultsVisibility: "live" | "after_close" | "owner_only") {
    return createPoll(db, ownerId, pollInput({ resultsVisibility, closesAtLocal: "2026-10-26T12:00" }), T0);
  }

  it("answers 404 for a slug nobody created", async () => {
    expect(await resultsHttpStatus(db, null, "no-such-poll", open)).toBe(404);
  });

  it("answers 200 for live results, to anyone", async () => {
    const { slug } = await poll("live");
    expect(await resultsHttpStatus(db, null, slug, open)).toBe(200);
    expect(await resultsHttpStatus(db, strangerId, slug, open)).toBe(200);
  });

  it("answers 403 for results hidden until close, and 200 once closed or to the owner", async () => {
    const { slug } = await poll("after_close");
    expect(await resultsHttpStatus(db, null, slug, open)).toBe(403);
    expect(await resultsHttpStatus(db, strangerId, slug, open)).toBe(403);
    expect(await resultsHttpStatus(db, ownerId, slug, open)).toBe(200);
    expect(await resultsHttpStatus(db, null, slug, afterClose)).toBe(200);
  });

  it("answers 404 for owner-only results to everyone but the owner", async () => {
    const { slug } = await poll("owner_only");
    expect(await resultsHttpStatus(db, null, slug, afterClose)).toBe(404);
    expect(await resultsHttpStatus(db, strangerId, slug, afterClose)).toBe(404);
    expect(await resultsHttpStatus(db, ownerId, slug, open)).toBe(200);
  });
});
