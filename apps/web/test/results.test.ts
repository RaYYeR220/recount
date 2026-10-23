import { parseFixed } from "@recount/engine";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { castBallot } from "@/server/ballots/cast";
import type { Db } from "@/server/db/client";
import { poll as pollTable } from "@/server/db/schema";
import { closePoll } from "@/server/polls/close";
import { createPoll } from "@/server/polls/create";
import type { PollDetail } from "@/server/polls/detail";
import { updatePoll } from "@/server/polls/update";
import { getCvr } from "@/server/results/cvr";
import { getResults, getResultsRctab } from "@/server/results/get";
import { seedFromSha256 } from "@/server/results/tabulatePoll";
import { canSeeResults } from "@/server/results/visibility";
import { createTestDb } from "./db";
import { T0, createUser, errorCode, insertBallot, minutesAfter, pollInput, rejectionOf } from "./factories";

const OPTIONS = ["Alder", "Birch", "Cedar"];

/** Alder leads round 1 (4-3-2); Cedar's two ballots go to Birch, who wins round 2 with 5 of 9. */
const NINE_BALLOTS = [
  ...Array(2).fill(["Alder", "Birch"]),
  ...Array(2).fill(["Alder"]),
  ...Array(3).fill(["Birch", "Cedar"]),
  ...Array(2).fill(["Cedar", "Birch"]),
] as string[][];

const now = minutesAfter(30);
const later = minutesAfter(60);

describe("results", () => {
  let db: Db;
  let ownerId: string;
  let strangerId: string;

  async function pollWith(ballots: string[][], overrides = {}) {
    const poll = await createPoll(
      db,
      ownerId,
      pollInput({ options: OPTIONS, closesAtLocal: "2026-10-26T12:00", ...overrides }),
      T0,
    );
    const idOf = new Map(poll.options.map((o) => [o.label, o.id]));
    for (const [i, ranking] of ballots.entries()) {
      await castBallot(
        db,
        { slug: poll.slug, ranking: ranking.map((label) => idOf.get(label)!), voterToken: `voter-${i}` },
        minutesAfter(1),
      );
    }
    return poll;
  }

  beforeAll(async () => {
    db = await createTestDb();
    ownerId = (await createUser(db, "Ada")).id;
    strangerId = (await createUser(db, "Rival")).id;
  });

  describe("tabulation", () => {
    it("counts the nine hand ballots in two IRV rounds", async () => {
      const poll = await pollWith(NINE_BALLOTS);
      const results = await getResults(db, null, poll.slug, now);

      expect(results).toMatchObject({ status: "open", totalBallots: 9, winners: ["Birch"], isSnapshot: false });
      expect(results.rounds.map((r) => r.tally)).toEqual([
        { Alder: "4", Birch: "3", Cedar: "2" },
        { Alder: "4", Birch: "5" },
      ]);
      expect(results.rounds[0]).toMatchObject({
        threshold: "5",
        eliminated: ["Cedar"],
        transfers: [{ from: "Cedar", to: { Birch: "2" } }],
      });
      expect(results.pluralityWinner).toBe("Alder");
      expect(results.condorcetWinner).toBe("Birch");
    });

    it("elects two in a two-seat STV poll", async () => {
      const poll = await pollWith(
        [
          ...Array(5).fill(["Alder", "Birch"]),
          ...Array(3).fill(["Birch"]),
          ...Array(2).fill(["Cedar", "Dogwood"]),
          ...Array(2).fill(["Dogwood", "Cedar"]),
        ],
        { options: [...OPTIONS, "Dogwood"], seats: 2 },
      );
      const results = await getResults(db, null, poll.slug, now);
      expect(results.winners).toHaveLength(2);
      expect(results.winners).toContain("Alder");
      expect(results.rules.numberOfWinners).toBe(2);
    });

    it("uses the poll's rank limit and seeds every random tiebreak from the CVR hash", async () => {
      for (const presetId of ["recount-standard", "nyc"] as const) {
        const poll = await pollWith(NINE_BALLOTS.slice(0, 4), { presetId, maxRanks: 2 });
        const results = await getResults(db, null, poll.slug, now);
        expect(results.rules.maxRankingsAllowed).toBe(2);
        expect(results.rules.randomSeed).toBe(seedFromSha256(results.cvrSha256));
        expect(results.rules.randomSeed).toBe(BigInt(`0x${results.cvrSha256.slice(0, 15)}`).toString());
      }
      const unlimited = await pollWith(NINE_BALLOTS.slice(0, 2));
      expect((await getResults(db, null, unlimited.slug, now)).rules.maxRankingsAllowed).toBe("max");
    });

    it("answers an empty count for a poll without ballots", async () => {
      const poll = await pollWith([]);
      const open = await getResults(db, null, poll.slug, now);
      expect(open).toMatchObject({ totalBallots: 0, rounds: [], winners: [], condorcetWinner: null });

      await closePoll(db, ownerId, poll.slug, now);
      const closed = await getResults(db, null, poll.slug, later);
      expect(closed).toMatchObject({ status: "closed", totalBallots: 0, rounds: [], winners: [], isSnapshot: true });
      expect((await getResultsRctab(db, null, poll.slug, later)).results).toEqual([]);
    });

    it("recounts a live poll on every read", async () => {
      const poll = await pollWith(NINE_BALLOTS.slice(0, 3));
      const before = await getResults(db, null, poll.slug, now);
      await castBallot(db, { slug: poll.slug, ranking: [poll.options[2].id], voterToken: "late" }, now);
      const after = await getResults(db, null, poll.slug, now);

      expect(after.totalBallots).toBe(before.totalBallots + 1);
      expect(after.cvrSha256).not.toBe(before.cvrSha256);
    });

    it("reports the same numbers as the RCTab summary", async () => {
      const poll = await pollWith(NINE_BALLOTS);
      const results = await getResults(db, null, poll.slug, now);
      const rctab = await getResultsRctab(db, null, poll.slug, now);

      expect(rctab.results).toHaveLength(results.rounds.length);
      for (const [i, round] of results.rounds.entries()) {
        for (const [label, votes] of Object.entries(round.tally)) {
          expect(parseFixed(rctab.results[i].tally[label], 4), `${label} round ${i + 1}`).toBe(parseFixed(votes, 4));
        }
        expect(parseFixed(rctab.results[i].threshold, 4)).toBe(parseFixed(round.threshold, 4));
      }
      expect(rctab.results.at(-1)?.tallyResults.find((t) => t.elected)?.elected).toBe(results.winners[0]);
      expect(rctab.summary.totalNumBallots).toBe("9");
    });
  });

  describe("close snapshot", () => {
    it("freezes the count and its CVR hash when the organizer closes the poll", async () => {
      const poll = await pollWith(NINE_BALLOTS);
      await closePoll(db, ownerId, poll.slug, now);
      await insertBallot(db, poll.id, [poll.options[0].id], later);

      const results = await getResults(db, null, poll.slug, later);
      expect(results).toMatchObject({ status: "closed", isSnapshot: true, totalBallots: 9, winners: ["Birch"] });

      const [row] = await db.select().from(pollTable).where(eq(pollTable.id, poll.id));
      expect(row.cvrSha256).toBe(results.cvrSha256);
    });

    it("snapshots a poll that closed on schedule the first time its results are read", async () => {
      const poll = await pollWith(NINE_BALLOTS);
      const afterClose = new Date("2026-10-26T12:00:00Z");
      const results = await getResults(db, null, poll.slug, afterClose);
      expect(results).toMatchObject({ status: "closed", isSnapshot: true, totalBallots: 9 });

      const [row] = await db.select().from(pollTable).where(eq(pollTable.id, poll.id));
      expect(row.cvrSha256).toBe(results.cvrSha256);
    });

    it("refuses a ballot that read the clock before the close but reached the poll after it", async () => {
      const poll = await pollWith(NINE_BALLOTS);
      await closePoll(db, ownerId, poll.slug, now);
      const alder = poll.options.find((o) => o.label === "Alder")!.id;
      const late = castBallot(db, { slug: poll.slug, ranking: [alder], voterToken: "slow-network" }, minutesAfter(20));
      expect(await errorCode(late)).toBe("poll_closed");
      expect((await getCvr(db, null, poll.slug, later)).rows).toHaveLength(9);
    });

    it("refuses a ballot that reached a scheduled close after its snapshot was taken", async () => {
      const poll = await pollWith(NINE_BALLOTS);
      const afterClose = new Date("2026-10-26T12:00:00Z");
      const { cvrSha256 } = await getResults(db, null, poll.slug, afterClose);
      const alder = poll.options.find((o) => o.label === "Alder")!.id;
      const late = castBallot(db, { slug: poll.slug, ranking: [alder], voterToken: "slow-network" }, minutesAfter(20));
      expect(await errorCode(late)).toBe("poll_closed");
      expect((await getCvr(db, null, poll.slug, afterClose)).sha256).toBe(cvrSha256);
    });

    it("says when the poll closed to a ballot that arrives afterwards", async () => {
      const poll = await pollWith([]);
      await closePoll(db, ownerId, poll.slug, now);
      const error = await rejectionOf(
        castBallot(db, { slug: poll.slug, ranking: [poll.options[0].id], voterToken: "late" }, later),
      );
      expect(error.code).toBe("poll_closed");
      expect(error.details).toEqual({ closedAt: now });

      const onSchedule = await pollWith([]);
      const at = new Date("2026-10-27T00:00:00Z");
      const scheduled = await rejectionOf(
        castBallot(db, { slug: onSchedule.slug, ranking: [onSchedule.options[0].id], voterToken: "x" }, at),
      );
      expect(scheduled.details).toEqual({ closedAt: new Date("2026-10-26T12:00:00Z") });
    });

    it("keeps the ballot definition fixed after close, even without ballots", async () => {
      const poll = await pollWith([]);
      await closePoll(db, ownerId, poll.slug, now);
      expect(await errorCode(updatePoll(db, ownerId, poll.slug, { options: ["X", "Y"] }, later))).toBe(
        "options_locked",
      );
    });
  });

  describe("visibility", () => {
    let afterClose: PollDetail;
    let ownerOnly: PollDetail;

    beforeAll(async () => {
      afterClose = await pollWith(NINE_BALLOTS.slice(0, 3), { resultsVisibility: "after_close" });
      ownerOnly = await pollWith(NINE_BALLOTS.slice(0, 3), { resultsVisibility: "owner_only" });
    });

    it("hides after_close results from everyone but the owner until the poll closes", async () => {
      expect(await errorCode(getResults(db, null, afterClose.slug, now))).toBe("hidden_until_close");
      expect(await errorCode(getResults(db, strangerId, afterClose.slug, now))).toBe("hidden_until_close");
      expect((await getResults(db, ownerId, afterClose.slug, now)).totalBallots).toBe(3);

      const closedAt = new Date("2026-10-26T12:00:00Z");
      expect((await getResults(db, null, afterClose.slug, closedAt)).totalBallots).toBe(3);
    });

    it("answers not_found for owner_only results to anyone but the owner", async () => {
      const closedAt = new Date("2026-10-26T12:00:00Z");
      for (const at of [now, closedAt]) {
        expect(await errorCode(getResults(db, null, ownerOnly.slug, at))).toBe("not_found");
        expect(await errorCode(getResults(db, strangerId, ownerOnly.slug, at))).toBe("not_found");
        expect(await errorCode(getCvr(db, strangerId, ownerOnly.slug, at))).toBe("not_found");
      }
      expect((await getResults(db, ownerId, ownerOnly.slug, now)).totalBallots).toBe(3);
    });

    it("agrees with the visibility table", () => {
      const base = { ownerId, opensAt: T0, closesAt: minutesAfter(60), closedEarlyAt: null, createdAt: T0 };
      const cases = [
        ["live", null, now, "yes"],
        ["after_close", null, now, "hidden_until_close"],
        ["after_close", ownerId, now, "yes"],
        ["after_close", strangerId, later, "yes"],
        ["owner_only", strangerId, later, "not_found"],
        ["owner_only", ownerId, later, "yes"],
      ] as const;
      for (const [resultsVisibility, viewer, at, expected] of cases) {
        expect(canSeeResults({ ...base, resultsVisibility }, viewer, at)).toBe(expected);
      }
    });
  });

  describe("CVR", () => {
    it("is only published once the poll is closed", async () => {
      const poll = await pollWith(NINE_BALLOTS);
      expect(await errorCode(getCvr(db, ownerId, poll.slug, now))).toBe("cvr_not_published");
    });

    it("lists labels by rank, ordered by receipt, with a stable hash equal to the snapshot's", async () => {
      const poll = await pollWith(NINE_BALLOTS);
      await closePoll(db, ownerId, poll.slug, now);

      const first = await getCvr(db, null, poll.slug, later);
      const second = await getCvr(db, null, poll.slug, later);
      expect(first.header).toEqual(["Rank 1", "Rank 2", "Rank 3"]);
      expect(first.rows).toHaveLength(9);
      expect(first.rows).toContainEqual(["Alder", "", ""]);
      expect(first.rows).toContainEqual(["Cedar", "Birch", ""]);
      expect(second.sha256).toBe(first.sha256);
      expect(first.sha256).toBe((await getResults(db, null, poll.slug, later)).cvrSha256);
      expect(first.csv.split("\n")[0]).toBe("Rank 1,Rank 2,Rank 3");
    });

    it("orders rows by receipt, never by when each ballot was cast", async () => {
      const poll = await createPoll(db, ownerId, pollInput({ options: OPTIONS, closesAtLocal: "2026-10-26T12:00" }), T0);
      const idOf = new Map(poll.options.map((o) => [o.label, o.id]));
      const cast: Array<{ receipt: string; ranking: string[] }> = [];
      for (const [i, ranking] of NINE_BALLOTS.entries()) {
        const ids = ranking.map((label) => idOf.get(label)!);
        const { receipt } = await castBallot(db, { slug: poll.slug, ranking: ids, voterToken: `late-${i}` }, minutesAfter(1 + i));
        cast.push({ receipt, ranking });
      }
      await closePoll(db, ownerId, poll.slug, now);

      const { rows } = await getCvr(db, null, poll.slug, later);
      const byReceipt = cast
        .sort((a, b) => (a.receipt < b.receipt ? -1 : 1))
        .map(({ ranking }) => [...ranking, ...Array(OPTIONS.length - ranking.length).fill("")]);
      expect(rows).toEqual(byReceipt);
    });
  });
});
