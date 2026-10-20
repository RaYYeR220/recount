import { beforeAll, describe, expect, it } from "vitest";
import { pollCvrEndpoint, pollResultsEndpoint } from "@/server/api/results";
import type { Db } from "@/server/db/client";
import { insertSeedPoll } from "@/server/seed/insert";
import { showcasePolls } from "@/server/seed/showcase";
import { showcaseCvr, showcasePoll } from "@/server/seed/showcaseCvr";
import { call, type Handler } from "./apiClient";
import { createTestDb } from "./db";
import { createUser, T0 } from "./factories";

describe("showcaseCvr", () => {
  let db: Db;
  const deps = { db: () => db, now: () => T0 };

  beforeAll(async () => {
    db = await createTestDb();
    const owner = await createUser(db);
    for (const slug of ["lunch-closed", "committee-2026"]) {
      await insertSeedPoll(db, owner.id, showcasePolls(T0).find((p) => p.slug === slug)!, T0);
    }
  }, 60_000);

  for (const slug of ["lunch-closed", "committee-2026"]) {
    it(`gives ${slug} the exact bytes and hash the CVR endpoint serves`, async () => {
      const res = await call(pollCvrEndpoint(deps) as Handler, `/polls/${slug}/cvr?format=csv`);
      expect(res.status).toBe(200);
      const served = await res.text();
      const built = showcaseCvr(slug);
      expect(built.csv).toBe(served);
      expect(built.sha256).toBe(res.headers.get("x-cvr-sha256"));
    });
  }

  it("matches the hash the closed poll's snapshot was counted from", async () => {
    const res = await call(pollResultsEndpoint(deps) as Handler, "/polls/lunch-closed/results");
    const results = (await res.json()) as { cvrSha256: string; winners: string[] };
    expect(results.cvrSha256).toBe(showcaseCvr("lunch-closed").sha256);
    expect(results.winners).toEqual(["Tacos"]);
  });

  it("does not depend on when the seed ran", () => {
    expect(showcasePoll("lunch-closed").ballots).toEqual(showcasePolls(T0).find((p) => p.slug === "lunch-closed")!.ballots);
    expect(showcaseCvr("lunch-closed").sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("refuses a slug the seed does not have", () => {
    expect(() => showcaseCvr("no-such-poll")).toThrow("no showcase poll no-such-poll");
  });
});
