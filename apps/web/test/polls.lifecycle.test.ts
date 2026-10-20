import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { listAudit } from "@/server/audit";
import type { Db } from "@/server/db/client";
import { auditEvent } from "@/server/db/schema";
import { closePoll } from "@/server/polls/close";
import { createPoll } from "@/server/polls/create";
import { getPollForOwner, getPublicPoll } from "@/server/polls/get";
import { listPolls } from "@/server/polls/list";
import { deletePoll } from "@/server/polls/remove";
import { pollStatus } from "@/server/polls/status";
import { updatePoll } from "@/server/polls/update";
import { createTestDb } from "./db";
import {
  T0,
  createUser,
  errorCode,
  insertBallot,
  minutesAfter,
  pollInput,
  rejectionOf,
} from "./factories";

describe("pollStatus", () => {
  const opensAt = minutesAfter(60);
  const closesAt = minutesAfter(120);
  const base = { opensAt, closesAt, closedEarlyAt: null, createdAt: T0 };

  it("is scheduled before opensAt", () => {
    expect(pollStatus(base, minutesAfter(59))).toBe("scheduled");
  });

  it("is open exactly at opensAt", () => {
    expect(pollStatus(base, opensAt)).toBe("open");
  });

  it("is closed exactly at closesAt", () => {
    expect(pollStatus(base, new Date(closesAt.getTime() - 1))).toBe("open");
    expect(pollStatus(base, closesAt)).toBe("closed");
  });

  it("is closed from the moment it was closed early", () => {
    const closedEarlyAt = minutesAfter(90);
    expect(pollStatus({ ...base, closedEarlyAt }, minutesAfter(89))).toBe("open");
    expect(pollStatus({ ...base, closedEarlyAt }, closedEarlyAt)).toBe("closed");
  });

  it("falls back to createdAt when there is no opensAt and stays open without closesAt", () => {
    const p = { opensAt: null, closesAt: null, closedEarlyAt: null, createdAt: T0 };
    expect(pollStatus(p, minutesAfter(-1))).toBe("scheduled");
    expect(pollStatus(p, minutesAfter(10_000))).toBe("open");
  });
});

describe("poll lifecycle", () => {
  let db: Db;
  let owner: { id: string; email: string };
  let stranger: { id: string; email: string };

  beforeAll(async () => {
    db = await createTestDb();
    owner = await createUser(db, "Ada");
    stranger = await createUser(db, "Rival");
  });

  describe("createPoll", () => {
    it("creates an open poll with options in order", async () => {
      const poll = await createPoll(db, owner.id, pollInput(), T0);
      expect(poll.slug).toMatch(/^[23456789abcdefghjkmnpqrstuvwxyz]{10}$/);
      expect(poll.status).toBe("open");
      expect(poll.options.map((o) => [o.label, o.position])).toEqual([
        ["Pizza", 0],
        ["Tacos", 1],
        ["Sushi", 2],
      ]);
      expect(poll.ballotCount).toBe(0);
      expect(poll.warnings).toEqual([]);
    });

    it("resolves the schedule in the poll's time zone and reports DST adjustments", async () => {
      const poll = await createPoll(
        db,
        owner.id,
        pollInput({
          timeZone: "America/New_York",
          opensAtLocal: "2026-10-31T09:00",
          closesAtLocal: "2026-11-01T01:30",
        }),
        T0,
      );
      expect(poll.status).toBe("scheduled");
      expect(poll.opensAt?.toISOString()).toBe("2026-10-31T13:00:00.000Z");
      expect(poll.closesAt?.toISOString()).toBe("2026-11-01T05:30:00.000Z");
      expect(poll.warnings).toEqual([{ field: "closesAt", code: "dst_overlap_earlier" }]);
    });

    it.each([
      ["a single option", { options: ["Pizza"] }, "options"],
      ["labels equal after trim and case folding", { options: ["Pizza", " pizza ", "Tacos"] }, "options"],
      ["as many seats as options", { seats: 3, presetId: "portland-stv" as const }, "seats"],
      ["more ranks than options", { maxRanks: 4 }, "maxRanks"],
      ["a too-short title", { title: "Hi" }, "title"],
      ["an unknown time zone", { timeZone: "Mars/Olympus" }, "timeZone"],
      ["an IRV-only preset with two seats", { presetId: "nyc" as const, seats: 2 }, "presetId"],
      ["an STV-only preset with one seat", { presetId: "portland-stv" as const }, "presetId"],
      ["a malformed local time", { closesAtLocal: "2026-10-20 10:00" }, "closesAtLocal"],
      [
        "a close before the open",
        { opensAtLocal: "2026-10-20T10:00", closesAtLocal: "2026-10-20T09:00" },
        "closesAtLocal",
      ],
      [
        "a close less than a minute after the open",
        { opensAtLocal: "2026-10-20T10:00", closesAtLocal: "2026-10-20T10:00" },
        "closesAtLocal",
      ],
      ["a close in the past", { closesAtLocal: "2026-10-19T11:59" }, "closesAtLocal"],
    ])("rejects %s", async (_, overrides, path) => {
      const error = await rejectionOf(createPoll(db, owner.id, pollInput(overrides), T0));
      expect(error.code).toBe("validation");
      expect(error.details).toMatchObject({ issues: expect.arrayContaining([expect.objectContaining({ path })]) });
    });

    it("accepts the widest allowed shape", async () => {
      const options = Array.from({ length: 30 }, (_, i) => `Option ${i + 1}`);
      const poll = await createPoll(
        db,
        owner.id,
        pollInput({ options, seats: 29, presetId: "portland-stv", maxRanks: 30 }),
        T0,
      );
      expect(poll.options).toHaveLength(30);
    });
  });

  describe("updatePoll", () => {
    it("edits the title and options before any ballot", async () => {
      const { slug } = await createPoll(db, owner.id, pollInput(), T0);
      const updated = await updatePoll(
        db,
        owner.id,
        slug,
        { title: "Friday lunch", options: ["Ramen", "Tacos"] },
        minutesAfter(1),
      );
      expect(updated.title).toBe("Friday lunch");
      expect(updated.options.map((o) => o.label)).toEqual(["Ramen", "Tacos"]);
      expect(updated.updatedAt).toEqual(minutesAfter(1));
    });

    it("locks options once a ballot exists", async () => {
      const poll = await createPoll(db, owner.id, pollInput(), T0);
      await insertBallot(db, poll.id, [poll.options[1].id]);

      const code = await errorCode(
        updatePoll(db, owner.id, poll.slug, { options: ["Pizza", "Tacos", "Curry"] }, minutesAfter(1)),
      );
      expect(code).toBe("options_locked");
      const after = await getPollForOwner(db, owner.id, poll.slug, minutesAfter(1));
      expect(after.options.map((o) => o.id)).toEqual(poll.options.map((o) => o.id));
    });

    it("still allows title edits and an identical option list once a ballot exists", async () => {
      const poll = await createPoll(db, owner.id, pollInput(), T0);
      await insertBallot(db, poll.id, [poll.options[0].id]);
      const updated = await updatePoll(
        db,
        owner.id,
        poll.slug,
        { title: "Renamed", options: ["Pizza", "Tacos", "Sushi"] },
        minutesAfter(1),
      );
      expect(updated.title).toBe("Renamed");
      expect(updated.options.map((o) => o.id)).toEqual(poll.options.map((o) => o.id));
    });

    it("validates the merged shape", async () => {
      const { slug } = await createPoll(db, owner.id, pollInput(), T0);
      expect(await errorCode(updatePoll(db, owner.id, slug, { seats: 3 }, T0))).toBe("validation");
    });

    it("moves the opening time while scheduled", async () => {
      const { slug } = await createPoll(db, owner.id, pollInput({ opensAtLocal: "2026-10-20T09:00" }), T0);
      const updated = await updatePoll(db, owner.id, slug, { opensAtLocal: "2026-10-21T09:00" }, T0);
      expect(updated.opensAt?.toISOString()).toBe("2026-10-21T09:00:00.000Z");
    });

    it("locks the opening time once open", async () => {
      const { slug } = await createPoll(db, owner.id, pollInput({ opensAtLocal: "2026-10-20T09:00" }), T0);
      const later = new Date("2026-10-20T09:00:00Z");
      expect(await errorCode(updatePoll(db, owner.id, slug, { opensAtLocal: "2026-10-22T09:00" }, later))).toBe(
        "schedule_locked",
      );
    });

    it("extends the closing time while open", async () => {
      const { slug } = await createPoll(db, owner.id, pollInput({ closesAtLocal: "2026-10-20T12:00" }), T0);
      const updated = await updatePoll(db, owner.id, slug, { closesAtLocal: "2026-10-27T12:00" }, minutesAfter(30));
      expect(updated.status).toBe("open");
      expect(updated.closesAt?.toISOString()).toBe("2026-10-27T12:00:00.000Z");
    });

    it("rejects a closing time in the past while open", async () => {
      const { slug } = await createPoll(db, owner.id, pollInput({ closesAtLocal: "2026-10-20T12:00" }), T0);
      expect(
        await errorCode(updatePoll(db, owner.id, slug, { closesAtLocal: "2026-10-19T12:10" }, minutesAfter(30))),
      ).toBe("validation");
    });

    it("locks the closing time once closed", async () => {
      const { slug } = await createPoll(db, owner.id, pollInput({ closesAtLocal: "2026-10-20T12:00" }), T0);
      const afterClose = new Date("2026-10-20T12:00:00Z");
      expect(
        await errorCode(updatePoll(db, owner.id, slug, { closesAtLocal: "2026-10-27T12:00" }, afterClose)),
      ).toBe("schedule_locked");
    });
  });

  describe("closePoll", () => {
    it("closes an open poll now and is idempotent", async () => {
      const { slug } = await createPoll(db, owner.id, pollInput({ closesAtLocal: "2026-10-26T12:00" }), T0);
      const closed = await closePoll(db, owner.id, slug, minutesAfter(5));
      expect(closed.status).toBe("closed");
      expect(closed.closedEarlyAt).toEqual(minutesAfter(5));

      const again = await closePoll(db, owner.id, slug, minutesAfter(9));
      expect(again.closedEarlyAt).toEqual(minutesAfter(5));
    });
  });

  describe("ownership", () => {
    it("answers not_found to anyone but the owner, exactly as for an unknown slug", async () => {
      const { slug } = await createPoll(db, owner.id, pollInput(), T0);
      const now = minutesAfter(1);

      for (const target of [slug, "nosuchpoll"]) {
        expect(await errorCode(getPollForOwner(db, stranger.id, target, now))).toBe("not_found");
        expect(await errorCode(updatePoll(db, stranger.id, target, { title: "Mine now" }, now))).toBe(
          "not_found",
        );
        expect(await errorCode(closePoll(db, stranger.id, target, now))).toBe("not_found");
        expect(await errorCode(deletePoll(db, stranger.id, target, now))).toBe("not_found");
        expect(await errorCode(listAudit(db, stranger.id, target))).toBe("not_found");
      }
      expect((await getPollForOwner(db, owner.id, slug, now)).title).toBe("Team lunch");
    });
  });

  describe("getPublicPoll", () => {
    it("exposes the ballot and schedule but nothing about the owner", async () => {
      const created = await createPoll(db, owner.id, pollInput(), T0);
      const poll = await getPublicPoll(db, created.slug, minutesAfter(1));
      expect(poll.status).toBe("open");
      expect(poll.options.map((o) => o.label)).toEqual(["Pizza", "Tacos", "Sushi"]);
      const json = JSON.stringify(poll);
      expect(json).not.toContain(owner.email);
      expect(json).not.toContain(owner.id);
    });

    it("answers not_found for an unknown slug", async () => {
      expect(await errorCode(getPublicPoll(db, "nosuchpoll", T0))).toBe("not_found");
    });
  });

  describe("deletePoll", () => {
    it("removes the poll and keeps the deletion in the audit trail", async () => {
      const { id, slug } = await createPoll(db, owner.id, pollInput(), T0);
      await deletePoll(db, owner.id, slug, minutesAfter(2));

      expect(await errorCode(getPollForOwner(db, owner.id, slug, minutesAfter(3)))).toBe("not_found");
      expect(await errorCode(getPublicPoll(db, slug, minutesAfter(3)))).toBe("not_found");
      const trail = await db
        .select()
        .from(auditEvent)
        .where(eq(auditEvent.pollId, id))
        .orderBy(auditEvent.at);
      expect(trail.map((e) => e.type)).toEqual(["poll.created", "poll.deleted"]);
    });
  });

  describe("audit", () => {
    it("records create, update and close without any ballot content", async () => {
      const poll = await createPoll(db, owner.id, pollInput(), T0);
      const cast = await insertBallot(db, poll.id, [poll.options[2].id, poll.options[0].id]);
      await updatePoll(db, owner.id, poll.slug, { description: "Vote by Friday" }, minutesAfter(1));
      await closePoll(db, owner.id, poll.slug, minutesAfter(2));

      const entries = await listAudit(db, owner.id, poll.slug);
      expect(entries.map((e) => [e.type, e.actorId])).toEqual([
        ["poll.created", owner.id],
        ["poll.updated", owner.id],
        ["poll.closed", owner.id],
      ]);
      expect(entries[1].detail).toEqual({ fields: ["description"] });
      const json = JSON.stringify(entries);
      for (const secret of [cast.receipt, ...poll.options.map((o) => o.id)]) {
        expect(json).not.toContain(secret);
      }
    });
  });
});

describe("listPolls", () => {
  let db: Db;
  let owner: string;

  beforeAll(async () => {
    db = await createTestDb();
    owner = (await createUser(db, "Ada")).id;
    const other = (await createUser(db, "Rival")).id;
    await createPoll(db, other, pollInput({ title: "Rival poll" }), T0);

    for (let i = 0; i < 45; i++) {
      const createdAt = minutesAfter(i);
      const kind = i % 3;
      const input = pollInput({
        title: i % 5 === 0 ? `Board Election ${i}` : `Lunch ${i}`,
        opensAtLocal: kind === 0 ? "2026-12-01T09:00" : null,
        closesAtLocal: kind === 0 ? "2026-12-02T09:00" : null,
      });
      const poll = await createPoll(db, owner, input, createdAt);
      if (kind === 2) await closePoll(db, owner, poll.slug, createdAt);
    }
  });

  const now = minutesAfter(60);

  it("pages through the owner's polls newest first", async () => {
    const first = await listPolls(db, owner, { pageSize: 20 }, now);
    expect(first).toMatchObject({ total: 45, page: 1, pageCount: 3 });
    expect(first.items).toHaveLength(20);
    expect(first.items[0].title).toBe("Lunch 44");

    const third = await listPolls(db, owner, { page: 3, pageSize: 20 }, now);
    expect(third.items).toHaveLength(5);
    expect(third.items.at(-1)?.title).toBe("Board Election 0");
  });

  it("filters by derived status", async () => {
    for (const status of ["scheduled", "open", "closed"] as const) {
      const page = await listPolls(db, owner, { status, pageSize: 100 }, now);
      expect(page.total).toBe(15);
      expect(page.items.every((p) => p.status === status)).toBe(true);
    }
  });

  it("searches titles case-insensitively", async () => {
    const page = await listPolls(db, owner, { search: "board ELECTION" }, now);
    expect(page.total).toBe(9);
    expect(page.items.every((p) => p.title.startsWith("Board Election"))).toBe(true);
  });

  it("treats LIKE wildcards in the search as plain text", async () => {
    expect((await listPolls(db, owner, { search: "%" }, now)).total).toBe(0);
  });

  it("never lists another owner's polls", async () => {
    expect((await listPolls(db, owner, { search: "Rival" }, now)).total).toBe(0);
  });
});
