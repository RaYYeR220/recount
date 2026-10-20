import { beforeAll, describe, expect, it } from "vitest";
import { clientIpFrom, limitAuthAttempt } from "@/server/authLimits";
import type { Db } from "@/server/db/client";
import { createTestDb } from "./db";
import { T0, errorCode, minutesAfter } from "./factories";

const from = (ip: string, header = "x-real-ip") => new Headers({ [header]: ip });

describe("per-IP limits on the auth actions", () => {
  let db: Db;

  beforeAll(async () => {
    db = await createTestDb();
  });

  it("reads the platform's address headers, first entry, trimmed", () => {
    expect(clientIpFrom(new Headers({ "x-vercel-forwarded-for": " 203.0.113.9, 10.0.0.1", "x-real-ip": "198.51.100.1" }))).toBe("203.0.113.9");
    expect(clientIpFrom(from("198.51.100.1"))).toBe("198.51.100.1");
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "198.51.100.2" }))).toBeNull();
  });

  it("refuses the 61st sign-in from one IP within a minute, and lets another IP in", async () => {
    for (let i = 0; i < 60; i++) await limitAuthAttempt(db, "signIn", from("192.0.2.61"), T0);
    expect(await errorCode(limitAuthAttempt(db, "signIn", from("192.0.2.61"), T0))).toBe("rate_limited");
    await expect(limitAuthAttempt(db, "signIn", from("192.0.2.62"), T0)).resolves.toBeUndefined();
    await expect(limitAuthAttempt(db, "signIn", from("192.0.2.61"), minutesAfter(2))).resolves.toBeUndefined();
  });

  it("refuses the 31st sign-up from one IP within a minute, counted apart from sign-ins", async () => {
    for (let i = 0; i < 30; i++) await limitAuthAttempt(db, "signUp", from("192.0.2.31", "x-vercel-forwarded-for"), T0);
    expect(await errorCode(limitAuthAttempt(db, "signUp", from("192.0.2.31", "x-vercel-forwarded-for"), T0))).toBe("rate_limited");
    await expect(limitAuthAttempt(db, "signIn", from("192.0.2.31"), T0)).resolves.toBeUndefined();
  });

  it("never limits a request without an address", async () => {
    for (let i = 0; i < 100; i++) await limitAuthAttempt(db, "signIn", new Headers(), T0);
    await expect(limitAuthAttempt(db, "signUp", new Headers(), T0)).resolves.toBeUndefined();
  });
});
