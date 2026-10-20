import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/client";
import { DomainError } from "@/server/errors";
import { checkRateLimit, clearRateLimit } from "@/server/rateLimit";
import { createTestDb } from "./db";

const t0 = new Date("2026-10-19T12:00:00Z");
const after = (seconds: number) => new Date(t0.getTime() + seconds * 1000);

async function codeOf(promise: Promise<unknown>) {
  const error = await promise.then(() => null, (e: unknown) => e);
  return error instanceof DomainError ? error.code : error;
}

describe("checkRateLimit", () => {
  let db: Db;

  beforeAll(async () => {
    db = await createTestDb();
  });

  it("allows up to the limit and rejects the next hit in the same window", async () => {
    for (let i = 0; i < 3; i++) await checkRateLimit(db, "a", 3, 60, after(i));
    expect(await codeOf(checkRateLimit(db, "a", 3, 60, after(10)))).toBe("rate_limited");
  });

  it("reports how long until the window ends", async () => {
    await checkRateLimit(db, "b", 1, 60, t0);
    const error = await checkRateLimit(db, "b", 1, 60, after(15)).catch((e: unknown) => e);
    expect((error as DomainError).details).toEqual({ retryAfterSeconds: 45 });
  });

  it("starts a fresh window once the previous one has passed", async () => {
    await checkRateLimit(db, "c", 1, 60, t0);
    await expect(checkRateLimit(db, "c", 1, 60, after(60))).resolves.toBeUndefined();
    expect(await codeOf(checkRateLimit(db, "c", 1, 60, after(61)))).toBe("rate_limited");
  });

  it("keeps keys independent", async () => {
    await checkRateLimit(db, "d1", 1, 60, t0);
    await expect(checkRateLimit(db, "d2", 1, 60, t0)).resolves.toBeUndefined();
  });

  it("can be cleared", async () => {
    await checkRateLimit(db, "e", 1, 60, t0);
    await clearRateLimit(db, "e");
    await expect(checkRateLimit(db, "e", 1, 60, after(1))).resolves.toBeUndefined();
  });

  it("counts concurrent hits exactly", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => checkRateLimit(db, "f", 5, 60, t0)),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(5);
  });
});
