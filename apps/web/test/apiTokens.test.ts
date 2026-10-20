import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import {
  authenticateApiToken,
  createApiToken,
  listApiTokens,
  revokeApiToken,
} from "@/server/apiTokens";
import type { Db } from "@/server/db/client";
import { apiToken } from "@/server/db/schema";
import { createTestDb } from "./db";
import { T0, createUser, errorCode, minutesAfter } from "./factories";

describe("API tokens", () => {
  let db: Db;
  let ada: string;
  let rival: string;

  beforeAll(async () => {
    db = await createTestDb();
    ada = (await createUser(db, "Ada")).id;
    rival = (await createUser(db, "Rival")).id;
  });

  it("shows a new token once and stores only its sha256", async () => {
    const { token } = await createApiToken(db, ada, "CI", T0);
    expect(token).toMatch(/^rk_[23456789abcdefghjkmnpqrstuvwxyz]{32}$/);

    const rows = await db.select().from(apiToken).where(eq(apiToken.userId, ada));
    expect(rows.map((r) => r.tokenHash)).not.toContain(token);
    expect(rows.every((r) => /^[0-9a-f]{64}$/.test(r.tokenHash))).toBe(true);
  });

  it("lists a user's tokens newest first without any secret", async () => {
    const user = (await createUser(db, "Lister")).id;
    await createApiToken(db, user, "laptop", T0);
    const { token } = await createApiToken(db, user, " deploy bot ", minutesAfter(1));

    const tokens = await listApiTokens(db, user);
    expect(tokens.map((t) => t.name)).toEqual(["deploy bot", "laptop"]);
    expect(tokens[0]).toEqual({ id: expect.any(String), name: "deploy bot", createdAt: minutesAfter(1), lastUsedAt: null });
    expect(JSON.stringify(tokens)).not.toContain(token);
  });

  it("authenticates a bearer token and records when it was used", async () => {
    const { token } = await createApiToken(db, ada, "script", T0);
    expect(await authenticateApiToken(db, `Bearer ${token}`, minutesAfter(5))).toEqual({ userId: ada });
    expect(await authenticateApiToken(db, `bearer  ${token}`, minutesAfter(6))).toEqual({ userId: ada });

    const used = (await listApiTokens(db, ada)).find((t) => t.name === "script");
    expect(used?.lastUsedAt).toEqual(minutesAfter(6));
  });

  it.each([null, "", "Bearer", "Basic abc", "Bearer rk_short", `Bearer rk_${"a".repeat(32)}`])(
    "rejects the header %j",
    async (header) => {
      expect(await authenticateApiToken(db, header, T0)).toBeNull();
    },
  );

  it("stops authenticating a revoked token", async () => {
    const { token } = await createApiToken(db, ada, "temporary", T0);
    const { id } = (await listApiTokens(db, ada)).find((t) => t.name === "temporary")!;
    await revokeApiToken(db, ada, id);
    expect(await authenticateApiToken(db, `Bearer ${token}`, T0)).toBeNull();
  });

  it("answers not_found when revoking someone else's or an unknown token", async () => {
    await createApiToken(db, ada, "mine", T0);
    const { id } = (await listApiTokens(db, ada)).find((t) => t.name === "mine")!;
    expect(await errorCode(revokeApiToken(db, rival, id))).toBe("not_found");
    expect(await errorCode(revokeApiToken(db, ada, "not-a-uuid"))).toBe("not_found");
  });

  it.each(["", "   ", "x".repeat(61)])("rejects the name %j", async (name) => {
    expect(await errorCode(createApiToken(db, ada, name, T0))).toBe("validation");
  });
});
