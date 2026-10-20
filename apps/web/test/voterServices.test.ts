import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { castBallot } from "@/server/ballots/cast";
import { checkInviteCode } from "@/server/ballots/gate";
import { findVoterBallot } from "@/server/ballots/voter";
import type { Db } from "@/server/db/client";
import { auditEvent, poll } from "@/server/db/schema";
import { closePoll } from "@/server/polls/close";
import { generateInviteCodes } from "@/server/polls/codes";
import { createPoll } from "@/server/polls/create";
import { previewPoll } from "@/server/polls/preview";
import { createTestDb } from "./db";
import { T0, createUser, errorCode, minutesAfter, pollInput, rejectionOf } from "./factories";

const now = minutesAfter(5);

describe("voter services", () => {
  let db: Db;
  let ownerId: string;

  beforeAll(async () => {
    db = await createTestDb();
    ownerId = (await createUser(db, "Ada")).id;
  });

  describe("findVoterBallot", () => {
    it("finds the receipt this voter token cast, and only in that poll", async () => {
      const first = await createPoll(db, ownerId, pollInput(), T0);
      const second = await createPoll(db, ownerId, pollInput(), T0);
      const { receipt } = await castBallot(
        db,
        { slug: first.slug, ranking: [first.options[1]!.id], voterToken: "browser-a" },
        now,
      );

      expect(await findVoterBallot(db, first.slug, "browser-a")).toEqual({ receipt, castAt: now });
      expect(await findVoterBallot(db, first.slug, "browser-b")).toBeNull();
      expect(await findVoterBallot(db, second.slug, "browser-a")).toBeNull();
      expect(await findVoterBallot(db, first.slug, "")).toBeNull();
      expect(await findVoterBallot(db, "no-such-poll", "browser-a")).toBeNull();
    });

    it("never finds a ballot cast with an invite code", async () => {
      const codesPoll = await createPoll(db, ownerId, pollInput({ accessMode: "codes" }), T0);
      const { codes } = await generateInviteCodes(db, ownerId, codesPoll.slug, 1, T0);
      await castBallot(
        db,
        { slug: codesPoll.slug, ranking: [codesPoll.options[0]!.id], code: codes[0], voterToken: "browser-a" },
        now,
      );
      expect(await findVoterBallot(db, codesPoll.slug, "browser-a")).toBeNull();
    });
  });

  describe("checkInviteCode", () => {
    it("accepts an unused code in any casing and returns it canonical, without using it up", async () => {
      const p = await createPoll(db, ownerId, pollInput({ accessMode: "codes" }), T0);
      const { codes } = await generateInviteCodes(db, ownerId, p.slug, 2, T0);
      const code = codes[0]!;
      const typed = ` ${code.replace("-", "").toLowerCase()} `;

      expect(await checkInviteCode(db, p.slug, typed, now)).toBe(code);
      expect(await checkInviteCode(db, p.slug, code, now)).toBe(code);
      await castBallot(db, { slug: p.slug, ranking: [p.options[0]!.id], code: typed, voterToken: "" }, now);
      expect(await errorCode(checkInviteCode(db, p.slug, code, now))).toBe("code_used");
      expect(await checkInviteCode(db, p.slug, codes[1]!, now)).toBe(codes[1]);
    });

    it("rejects codes that are malformed, unknown or from another poll", async () => {
      const p = await createPoll(db, ownerId, pollInput({ accessMode: "codes" }), T0);
      const other = await createPoll(db, ownerId, pollInput({ accessMode: "codes" }), T0);
      const { codes } = await generateInviteCodes(db, ownerId, other.slug, 1, T0);

      expect(await errorCode(checkInviteCode(db, p.slug, "WRONG-CODE-0000", now))).toBe("code_invalid");
      expect(await errorCode(checkInviteCode(db, p.slug, "AAAA-AAAA", now))).toBe("code_invalid");
      expect(await errorCode(checkInviteCode(db, p.slug, codes[0]!, now))).toBe("code_invalid");
      expect(await errorCode(checkInviteCode(db, p.slug, "   ", now))).toBe("code_required");
      expect(await errorCode(checkInviteCode(db, "no-such-poll", codes[0]!, now))).toBe("not_found");
    });

    it("answers for the schedule before the code", async () => {
      const later = await createPoll(db, ownerId, pollInput({ accessMode: "codes", opensAtLocal: "2026-10-25T09:00" }), T0);
      expect(await errorCode(checkInviteCode(db, later.slug, "AAAA-AAAA", now))).toBe("poll_not_open");

      const p = await createPoll(db, ownerId, pollInput({ accessMode: "codes" }), T0);
      const { codes } = await generateInviteCodes(db, ownerId, p.slug, 1, T0);
      await closePoll(db, ownerId, p.slug, now);
      const error = await rejectionOf(checkInviteCode(db, p.slug, codes[0]!, minutesAfter(6)));
      expect(error.code).toBe("poll_closed");
      expect(error.details).toEqual({ closedAt: now });
    });
  });

  describe("previewPoll", () => {
    it("returns what createPoll would, DST warnings included, and keeps nothing", async () => {
      const before = await db.$count(poll);
      const auditBefore = await db.$count(auditEvent);
      const input = pollInput({ timeZone: "America/New_York", opensAtLocal: "2027-03-14T02:30", closesAtLocal: "2027-11-07T01:30" });

      const preview = await previewPoll(db, ownerId, input, now);
      expect(preview.warnings).toEqual([
        { field: "opensAt", code: "dst_gap_shifted" },
        { field: "closesAt", code: "dst_overlap_earlier" },
      ]);
      expect(preview.opensAt).toEqual(new Date("2027-03-14T07:30:00Z"));
      expect(preview.closesAt).toEqual(new Date("2027-11-07T05:30:00Z"));
      expect(preview.status).toBe("scheduled");
      expect(preview.options.map((o) => o.label)).toEqual(["Pizza", "Tacos", "Sushi"]);

      expect(await db.$count(poll)).toBe(before);
      expect(await db.$count(auditEvent)).toBe(auditBefore);
      expect(await db.select().from(poll).where(eq(poll.slug, preview.slug))).toEqual([]);

      const created = await createPoll(db, ownerId, input, now);
      expect(created.warnings).toEqual(preview.warnings);
    });

    it("throws the validation createPoll would", async () => {
      const error = await rejectionOf(
        previewPoll(db, ownerId, pollInput({ options: ["Pizza", "pizza"], seats: 1, closesAtLocal: "2026-10-19T11:00" }), now),
      );
      expect(error.code).toBe("validation");
      const paths = (error.details as { issues: Array<{ path: string }> }).issues.map((i) => i.path);
      expect(paths).toContain("options");
    });
  });
});
