import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { castBallot } from "@/server/ballots/cast";
import { lookupReceipt } from "@/server/ballots/receipt";
import type { Db } from "@/server/db/client";
import { auditEvent, ballot } from "@/server/db/schema";
import { closePoll } from "@/server/polls/close";
import { generateInviteCodes, listInviteCodes } from "@/server/polls/codes";
import { createPoll } from "@/server/polls/create";
import type { PollDetail } from "@/server/polls/detail";
import { createTestDb } from "./db";
import { T0, createUser, errorCode, minutesAfter, pollInput, rejectionOf } from "./factories";

const CLOSES = "2026-10-20T12:00";
const closesAt = new Date("2026-10-20T12:00:00Z");
const now = minutesAfter(5);

describe("ballots", () => {
  let db: Db;
  let ownerId: string;
  let strangerId: string;

  const ballotsIn = async (pollId: string) => db.$count(ballot, eq(ballot.pollId, pollId));
  const ids = (poll: PollDetail, ...positions: number[]) => positions.map((i) => poll.options[i].id);

  async function linkPoll(overrides = {}) {
    return createPoll(db, ownerId, pollInput({ closesAtLocal: CLOSES, ...overrides }), T0);
  }

  async function codesPoll(codes = 3) {
    const poll = await createPoll(
      db,
      ownerId,
      pollInput({ accessMode: "codes", closesAtLocal: CLOSES }),
      T0,
    );
    const generated = await generateInviteCodes(db, ownerId, poll.slug, codes, T0);
    return { poll, codes: generated.codes };
  }

  beforeAll(async () => {
    db = await createTestDb();
    ownerId = (await createUser(db, "Ada")).id;
    strangerId = (await createUser(db, "Rival")).id;
  });

  describe("castBallot in link mode", () => {
    it("stores the ranking and returns a receipt that looks it up as labels in order", async () => {
      const poll = await linkPoll();
      const { receipt } = await castBallot(
        db,
        { slug: poll.slug, ranking: ids(poll, 2, 0), voterToken: "voter-1" },
        now,
      );
      expect(receipt).toMatch(/^[23456789abcdefghjkmnpqrstuvwxyz]{4}(-[23456789abcdefghjkmnpqrstuvwxyz]{4}){2}$/);

      const found = await lookupReceipt(db, poll.slug, receipt);
      expect(found).toEqual({ castAt: now, ranking: ["Sushi", "Pizza"] });
    });

    it("finds a receipt typed without dashes and in capitals", async () => {
      const poll = await linkPoll();
      const { receipt } = await castBallot(db, { slug: poll.slug, ranking: ids(poll, 1), voterToken: "v" }, now);
      const found = await lookupReceipt(db, poll.slug, ` ${receipt.replace(/-/g, "").toUpperCase()} `);
      expect(found.ranking).toEqual(["Tacos"]);
    });

    it("answers not_found for an unknown receipt or a receipt from another poll", async () => {
      const poll = await linkPoll();
      const other = await linkPoll();
      const { receipt } = await castBallot(db, { slug: poll.slug, ranking: ids(poll, 0), voterToken: "v" }, now);
      expect(await errorCode(lookupReceipt(db, other.slug, receipt))).toBe("not_found");
      expect(await errorCode(lookupReceipt(db, poll.slug, "aaaa-bbbb-cccc"))).toBe("not_found");
      expect(await errorCode(lookupReceipt(db, poll.slug, `${receipt}x`))).toBe("not_found");
    });

    it("rejects a second ballot from the same voter token", async () => {
      const poll = await linkPoll();
      await castBallot(db, { slug: poll.slug, ranking: ids(poll, 0), voterToken: "same" }, now);
      expect(
        await errorCode(castBallot(db, { slug: poll.slug, ranking: ids(poll, 1), voterToken: "same" }, now)),
      ).toBe("already_voted");
      await castBallot(db, { slug: poll.slug, ranking: ids(poll, 1), voterToken: "someone-else" }, now);
      expect(await ballotsIn(poll.id)).toBe(2);
    });

    it("lets one voter token vote once in each poll", async () => {
      const first = await linkPoll();
      const second = await linkPoll();
      await castBallot(db, { slug: first.slug, ranking: ids(first, 0), voterToken: "roaming" }, now);
      await expect(
        castBallot(db, { slug: second.slug, ranking: ids(second, 0), voterToken: "roaming" }, now),
      ).resolves.toHaveProperty("receipt");
    });

    it("requires a voter token", async () => {
      const poll = await linkPoll();
      expect(await errorCode(castBallot(db, { slug: poll.slug, ranking: ids(poll, 0), voterToken: "" }, now))).toBe(
        "validation",
      );
    });

    it("never keeps the raw voter token", async () => {
      const poll = await linkPoll();
      await castBallot(db, { slug: poll.slug, ranking: ids(poll, 0), voterToken: "raw-token-123" }, now);
      const [row] = await db.select().from(ballot).where(eq(ballot.pollId, poll.id));
      expect(row.voterTokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(row.voterTokenHash).not.toContain("raw-token-123");
    });
  });

  describe("schedule", () => {
    it("rejects a ballot before the poll opens", async () => {
      const poll = await linkPoll({ opensAtLocal: "2026-10-20T09:00" });
      expect(await errorCode(castBallot(db, { slug: poll.slug, ranking: ids(poll, 0), voterToken: "v" }, now))).toBe(
        "poll_not_open",
      );
    });

    it("rejects a ballot at the exact closing instant", async () => {
      const poll = await linkPoll();
      const justBefore = new Date(closesAt.getTime() - 1);
      await castBallot(db, { slug: poll.slug, ranking: ids(poll, 0), voterToken: "early" }, justBefore);
      expect(
        await errorCode(castBallot(db, { slug: poll.slug, ranking: ids(poll, 0), voterToken: "late" }, closesAt)),
      ).toBe("poll_closed");
    });

    it("rejects a ballot once the organizer has closed the poll", async () => {
      const poll = await linkPoll();
      await closePoll(db, ownerId, poll.slug, now);
      expect(await errorCode(castBallot(db, { slug: poll.slug, ranking: ids(poll, 0), voterToken: "v" }, now))).toBe(
        "poll_closed",
      );
    });

    it("answers not_found for an unknown poll", async () => {
      expect(await errorCode(castBallot(db, { slug: "nosuchpoll", ranking: [randomUUID()], voterToken: "v" }, now))).toBe(
        "not_found",
      );
    });
  });

  describe("ranking validation", () => {
    let poll: PollDetail;
    let foreign: PollDetail;

    beforeAll(async () => {
      poll = await linkPoll({ maxRanks: 2 });
      foreign = await linkPoll();
    });

    it.each([
      ["an empty ranking", () => []],
      ["a repeated option", () => ids(poll, 0, 0)],
      ["an option from another poll", () => ids(foreign, 0)],
      ["an id that is not a uuid", () => ["pizza"]],
      ["more ranks than the poll allows", () => ids(poll, 0, 1, 2)],
    ])("rejects %s", async (_, ranking) => {
      const error = await rejectionOf(
        castBallot(db, { slug: poll.slug, ranking: ranking(), voterToken: randomUUID() }, now),
      );
      expect(error.code).toBe("validation");
      expect(JSON.stringify(error)).not.toContain(poll.options[0].id);
    });

    it("accepts a partial ranking up to the limit", async () => {
      await castBallot(db, { slug: poll.slug, ranking: ids(poll, 2, 1), voterToken: randomUUID() }, now);
      expect(await ballotsIn(poll.id)).toBe(1);
    });
  });

  describe("castBallot in codes mode", () => {
    it("accepts each code once", async () => {
      const { poll, codes } = await codesPoll();
      const { receipt } = await castBallot(
        db,
        { slug: poll.slug, ranking: ids(poll, 0), code: codes[0], voterToken: "a" },
        now,
      );
      expect(receipt).toHaveLength(14);
      expect(
        await errorCode(castBallot(db, { slug: poll.slug, ranking: ids(poll, 1), code: codes[0], voterToken: "b" }, now)),
      ).toBe("code_used");
    });

    it("lets one browser vote with several codes", async () => {
      const { poll, codes } = await codesPoll();
      for (const code of codes) {
        await castBallot(db, { slug: poll.slug, ranking: ids(poll, 0), code, voterToken: "shared" }, now);
      }
      expect(await ballotsIn(poll.id)).toBe(3);
    });

    it("normalises how the code was typed", async () => {
      const { poll, codes } = await codesPoll();
      const typed = ` ${codes[0].replace("-", "").toLowerCase()} `;
      await castBallot(db, { slug: poll.slug, ranking: ids(poll, 0), code: typed, voterToken: "a" }, now);
      expect((await listInviteCodes(db, ownerId, poll.slug)).find((c) => c.code === codes[0])?.usedAt).toEqual(now);
    });

    it("requires a code", async () => {
      const { poll } = await codesPoll();
      for (const code of [undefined, "", "   "]) {
        expect(await errorCode(castBallot(db, { slug: poll.slug, ranking: ids(poll, 0), code, voterToken: "a" }, now))).toBe(
          "code_required",
        );
      }
    });

    it("rejects unknown codes and codes of another poll", async () => {
      const { poll } = await codesPoll();
      const other = await codesPoll();
      for (const code of ["ZZZZ-ZZZZ", "nonsense", other.codes[0]]) {
        expect(await errorCode(castBallot(db, { slug: poll.slug, ranking: ids(poll, 0), code, voterToken: "a" }, now))).toBe(
          "code_invalid",
        );
      }
    });

    it("does not burn a code on a rejected ballot", async () => {
      const { poll, codes } = await codesPoll();
      await rejectionOf(castBallot(db, { slug: poll.slug, ranking: [], code: codes[0], voterToken: "a" }, now));
      await castBallot(db, { slug: poll.slug, ranking: ids(poll, 0), code: codes[0], voterToken: "a" }, now);
      expect(await ballotsIn(poll.id)).toBe(1);
    });

    it("stores exactly one ballot when two voters submit the same code at once", async () => {
      const { poll, codes } = await codesPoll(1);
      const results = await Promise.allSettled([
        castBallot(db, { slug: poll.slug, ranking: ids(poll, 0), code: codes[0], voterToken: "a" }, now),
        castBallot(db, { slug: poll.slug, ranking: ids(poll, 1), code: codes[0], voterToken: "b" }, now),
      ]);

      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const rejected = results.find((r) => r.status === "rejected");
      expect((rejected as PromiseRejectedResult).reason).toMatchObject({ code: "code_used" });
      expect(await ballotsIn(poll.id)).toBe(1);
    });
  });

  describe("invite codes", () => {
    it("generates distinct codes in the XXXX-XXXX format and lists them with their use", async () => {
      const { poll, codes } = await codesPoll(25);
      expect(new Set(codes).size).toBe(25);
      for (const code of codes) expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/);

      await castBallot(db, { slug: poll.slug, ranking: ids(poll, 0), code: codes[3], voterToken: "a" }, now);
      const listed = await listInviteCodes(db, ownerId, poll.slug);
      expect(listed.map((c) => c.code).sort()).toEqual([...codes].sort());
      expect(listed.filter((c) => c.usedAt !== null)).toEqual([{ code: codes[3], usedAt: now }]);
    });

    it("rejects batches outside 1..500", async () => {
      const { poll } = await codesPoll(1);
      for (const count of [0, 501, 2.5]) {
        expect(await errorCode(generateInviteCodes(db, ownerId, poll.slug, count, now))).toBe("validation");
      }
    });

    it("caps a poll at 5,000 codes", async () => {
      const poll = await createPoll(db, ownerId, pollInput({ accessMode: "codes" }), T0);
      for (let i = 0; i < 10; i++) await generateInviteCodes(db, ownerId, poll.slug, 500, now);
      expect(await errorCode(generateInviteCodes(db, ownerId, poll.slug, 1, now))).toBe("validation");
      expect((await listInviteCodes(db, ownerId, poll.slug)).length).toBe(5000);
    });

    it("only makes codes for polls in codes mode", async () => {
      const poll = await linkPoll();
      expect(await errorCode(generateInviteCodes(db, ownerId, poll.slug, 5, now))).toBe("validation");
    });

    it("hides codes from everyone but the owner", async () => {
      const { poll } = await codesPoll();
      expect(await errorCode(listInviteCodes(db, strangerId, poll.slug))).toBe("not_found");
      expect(await errorCode(generateInviteCodes(db, strangerId, poll.slug, 5, now))).toBe("not_found");
    });

    it("records generation in the audit trail without the codes", async () => {
      const { poll, codes } = await codesPoll(4);
      const entries = await db.select().from(auditEvent).where(eq(auditEvent.pollId, poll.id));
      const entry = entries.find((e) => e.type === "codes.generated");
      expect(entry).toMatchObject({ actorId: ownerId, detail: { count: 4 } });
      expect(JSON.stringify(entry)).not.toContain(codes[0]);
    });
  });
});
