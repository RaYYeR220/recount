import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { purgeEndpoint } from "@/server/api/cron";
import { createAuth } from "@/server/auth";
import { lookupReceipt } from "@/server/ballots/receipt";
import type { Db } from "@/server/db/client";
import { auditEvent, ballot, inviteCode, poll, pollOption, rateLimit, user } from "@/server/db/schema";
import { DEMO_PERSONAS } from "@/server/demo";
import { listInviteCodes } from "@/server/polls/codes";
import { createPoll } from "@/server/polls/create";
import { getPollForOwner, getPublicPoll } from "@/server/polls/get";
import { listPolls } from "@/server/polls/list";
import { purgeRateLimits, purgeTestData } from "@/server/purge";
import { getResults } from "@/server/results/get";
import { seed } from "@/server/seed";
import { seedReceipt } from "@/server/seed/insert";
import { call, type Handler } from "./apiClient";
import { createTestDb } from "./db";
import { T0, errorCode, minutesAfter, pollInput } from "./factories";

const now = T0;

describe("seed", () => {
  let db: Db;
  let ada: string;
  let rival: string;

  const counts = async () => ({
    users: await db.$count(user),
    polls: await db.$count(poll),
    options: await db.$count(pollOption),
    ballots: await db.$count(ballot),
    codes: await db.$count(inviteCode),
    audit: await db.$count(auditEvent),
  });

  beforeAll(async () => {
    db = await createTestDb();
    expect(await seed(db, now)).toEqual({ created: 122, skipped: 0 });
    const idOf = async (email: string) => (await db.select().from(user).where(eq(user.email, email)))[0].id;
    ada = await idOf("ada@recount.dev");
    rival = await idOf("rival@recount.dev");
  }, 180_000);

  it("changes nothing when it runs again", async () => {
    const before = await counts();
    expect(await seed(db, minutesAfter(90))).toEqual({ created: 0, skipped: 122 });
    expect(await counts()).toEqual(before);
  });

  it("gives ada exactly 120 polls and rival two", async () => {
    expect((await listPolls(db, ada, {}, now)).total).toBe(120);
    expect((await listPolls(db, rival, {}, now)).items.map((p) => p.slug)).toEqual(["rival-private", "rival-club"]);
  });

  it("spreads ada's polls over every status, preset and access mode, with ballots on closed ones", async () => {
    const all = (await listPolls(db, ada, { pageSize: 100 }, now)).items.concat(
      (await listPolls(db, ada, { pageSize: 100, page: 2 }, now)).items,
    );
    for (const status of ["scheduled", "open", "closed"]) {
      expect(all.filter((p) => p.status === status).length, status).toBeGreaterThanOrEqual(35);
    }
    expect(new Set(all.map((p) => p.presetId))).toEqual(
      new Set(["recount-standard", "nyc", "minneapolis-irv", "portland-stv"]),
    );
    expect(new Set(all.map((p) => p.accessMode))).toEqual(new Set(["link", "codes"]));
    expect(new Set(all.map((p) => p.resultsVisibility))).toEqual(new Set(["live", "after_close", "owner_only"]));
    expect(all.filter((p) => p.status === "closed").every((p) => p.ballotCount > 0)).toBe(true);
  });

  it("lets the personas sign in with their published passwords", async () => {
    const auth = createAuth(db, () => now);
    for (const persona of DEMO_PERSONAS) {
      const signedIn = await auth.api.signInEmail({ body: { email: persona.email, password: persona.password } });
      expect(signedIn.user.name).toBe(persona.name);
    }
  });

  describe("showcase polls", () => {
    it("offsite-2026 is open, link-shared, live and has a few ballots", async () => {
      const p = await getPollForOwner(db, ada, "offsite-2026", now);
      expect(p).toMatchObject({ title: "Team offsite location", status: "open", accessMode: "link", resultsVisibility: "live" });
      expect(p.options).toHaveLength(4);
      expect(p.ballotCount).toBeGreaterThan(0);
      expect(p.closesAt!.getTime()).toBeGreaterThan(now.getTime() + 4 * 365 * 86_400_000);
    });

    it("board-2026 is a three-seat STV election behind 40 unused codes", async () => {
      const p = await getPollForOwner(db, ada, "board-2026", now);
      expect(p).toMatchObject({ seats: 3, accessMode: "codes", resultsVisibility: "after_close", status: "open" });
      expect(p.opensAt!.getTime()).toBeLessThan(now.getTime());
      const codes = await listInviteCodes(db, ada, "board-2026");
      expect(codes).toHaveLength(40);
      expect(codes.every((c) => c.usedAt === null)).toBe(true);
    });

    it("lunch-closed is won by Tacos in two rounds although Pizza leads the first", async () => {
      const results = await getResults(db, null, "lunch-closed", now);
      expect(results).toMatchObject({
        status: "closed",
        isSnapshot: true,
        totalBallots: 13,
        winners: ["Tacos"],
        pluralityWinner: "Pizza",
        condorcetWinner: "Tacos",
      });
      expect(results.rounds.map((r) => r.tally)).toEqual([
        { Pizza: "6", Tacos: "4", Sushi: "3" },
        { Pizza: "6", Tacos: "7" },
      ]);
    });

    it("launch-2027 opens on 15 January 2027 at noon in New York for a week", async () => {
      const p = await getPublicPoll(db, "launch-2027", now);
      expect(p).toMatchObject({ title: "Product launch vote", status: "scheduled", timeZone: "America/New_York" });
      expect(p.opensAt?.toISOString()).toBe("2027-01-15T17:00:00.000Z");
      expect(p.closesAt?.toISOString()).toBe("2027-01-22T17:00:00.000Z");
    });

    it("committee-2026 elects two with a fractional surplus transfer", async () => {
      const results = await getResults(db, null, "committee-2026", now);
      expect(results.status).toBe("closed");
      expect(results.winners.sort()).toEqual(["Ana", "Ben"]);
      expect(results.rounds[0].transfers).toContainEqual({
        from: "Ana",
        to: expect.objectContaining({ Ben: "1.8000", Cleo: "1.2000" }),
      });
    });

    it("rival-private shows its results to rival only", async () => {
      expect(await errorCode(getResults(db, null, "rival-private", now))).toBe("not_found");
      expect(await errorCode(getResults(db, ada, "rival-private", now))).toBe("not_found");
      expect((await getResults(db, rival, "rival-private", now)).totalBallots).toBe(4);
    });

    it("has receipts a voter can look up", async () => {
      const found = await lookupReceipt(db, "lunch-closed", seedReceipt("lunch-closed", 0));
      expect(found.ranking).toEqual(["Pizza", "Tacos"]);
    });
  });
});

describe("purge", () => {
  let db: Db;
  const HOUR = 3_600_000;

  async function userAt(email: string, hoursAgo: number) {
    const id = randomUUID();
    await db.insert(user).values({ id, name: email, email, createdAt: new Date(now.getTime() - hoursAgo * HOUR) });
    const p = await createPoll(db, id, pollInput(), new Date(now.getTime() - hoursAgo * HOUR));
    return { id, pollId: p.id };
  }

  beforeAll(async () => {
    db = await createTestDb();
  });

  it("deletes only test accounts older than a day, with their polls and audit trail", async () => {
    const oldTest = await userAt("old@example.com", 48);
    const oldQa = await userAt("old@test.recount.dev", 30);
    const fresh = await userAt("fresh@example.com", 2);
    const real = await userAt("someone@realmail.org", 48);
    const persona = await userAt("persona@recount.dev", 48);

    expect(await purgeTestData(db, now)).toEqual({ users: 2, polls: 2 });

    const left = (await db.select({ email: user.email }).from(user)).map((u) => u.email).sort();
    expect(left).toEqual(["fresh@example.com", "persona@recount.dev", "someone@realmail.org"]);
    for (const gone of [oldTest, oldQa]) {
      expect(await db.$count(poll, eq(poll.id, gone.pollId))).toBe(0);
      expect(await db.$count(auditEvent, eq(auditEvent.pollId, gone.pollId))).toBe(0);
    }
    for (const kept of [fresh, real, persona]) expect(await db.$count(poll, eq(poll.id, kept.pollId))).toBe(1);
  });

  it("clears rate-limit windows older than a day and keeps current ones", async () => {
    await db.insert(rateLimit).values([
      { key: "cast:203.0.113.7:offsite-2026", windowStart: new Date(now.getTime() - 26 * 3_600_000), count: 3 },
      { key: "cast:203.0.113.8:offsite-2026", windowStart: new Date(now.getTime() - 30_000), count: 1 },
    ]);
    expect(await purgeRateLimits(db, now)).toBe(1);
    expect((await db.select({ key: rateLimit.key }).from(rateLimit)).map((r) => r.key)).toContain("cast:203.0.113.8:offsite-2026");
  });

  it("runs from the cron route only with the cron secret", async () => {
    const route = purgeEndpoint({ db: () => db, now: () => now }, () => "cron-secret-for-tests") as Handler;
    expect((await call(route, "/cron/purge")).status).toBe(401);
    expect((await call(route, "/cron/purge", { headers: { authorization: "Bearer nope" } })).status).toBe(401);
    const ok = await call(route, "/cron/purge", { headers: { authorization: "Bearer cron-secret-for-tests" } });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ users: 0, polls: 0, rateLimits: 0 });

    const unconfigured = purgeEndpoint({ db: () => db, now: () => now }, () => undefined) as Handler;
    expect((await call(unconfigured, "/cron/purge", { headers: { authorization: "Bearer " } })).status).toBe(401);
  });
});
