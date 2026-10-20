import { PRESETS as ENGINE_PRESETS } from "@recount/engine";
import { describe, expect, it } from "vitest";
import { pageItems, pageParam } from "@/lib/pager";
import { methodLabel, PRESETS, presetFits, showingText } from "@/lib/pollText";
import { moveDown, moveUp, ordinal, rankOption, removeOption } from "@/lib/ranking";
import { loginHref, safeNext } from "@/lib/safeNext";
import { MULTI_WINNER_ONLY, PRESET_IDS, SINGLE_WINNER_ONLY } from "@/server/polls/schema";

describe("safeNext", () => {
  it.each([
    ["/dashboard/p/rival-private", "/dashboard/p/rival-private"],
    ["/dashboard?q=Board&page=2", "/dashboard?q=Board&page=2"],
    ["/new", "/new"],
    ["/p/offsite-2026#ballot", "/p/offsite-2026#ballot"],
    ["/dashboard?x=1#y", "/dashboard?x=1#y"],
    // An encoded slash is part of one path segment, so this stays on the site.
    ["/%2F%2Fevil.com", "/%2F%2Fevil.com"],
  ])("keeps the same-site path %s", (raw, expected) => {
    expect(safeNext(raw)).toBe(expected);
  });

  it.each([
    "https://evil.example",
    "https://evil.example/dashboard",
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "/.//evil.com",
    "/./\\evil.com",
    "/a/..//evil.com",
    "/.//evil.example",
    "javascript:alert(1)",
    "evil.example",
    "/\n/evil.example",
    "/\t/evil.example",
    "/login",
    "/signup?next=/x",
    "/api/v1/polls",
    "",
  ])("ignores %j and goes to the dashboard", (raw) => {
    expect(safeNext(raw)).toBe("/dashboard");
  });

  it("ignores anything that is not a string", () => {
    expect(safeNext(undefined)).toBe("/dashboard");
    expect(safeNext(["/new"])).toBe("/dashboard");
  });

  it("builds the login link with the path encoded", () => {
    expect(loginHref("/dashboard?q=a b")).toBe("/login?next=%2Fdashboard%3Fq%3Da%20b");
  });
});

describe("ranking", () => {
  const r = ["a", "b", "c"];

  it("ranks the next choice once, up to the limit", () => {
    expect(rankOption(r, "d")).toEqual(["a", "b", "c", "d"]);
    expect(rankOption(r, "b")).toEqual(r);
    expect(rankOption(r, "d", 3)).toEqual(r);
    expect(rankOption(r, "d", null)).toEqual(["a", "b", "c", "d"]);
  });

  it("moves an option one place, never past the ends", () => {
    expect(moveUp(r, "b")).toEqual(["b", "a", "c"]);
    expect(moveUp(r, "c")).toEqual(["a", "c", "b"]);
    expect(moveUp(r, "a")).toEqual(r);
    expect(moveDown(r, "a")).toEqual(["b", "a", "c"]);
    expect(moveDown(r, "c")).toEqual(r);
    expect(moveUp(r, "x")).toEqual(r);
  });

  it("removes an option and closes the gap", () => {
    expect(removeOption(r, "a")).toEqual(["b", "c"]);
  });

  it("never changes the list it was given", () => {
    const before = [...r];
    moveUp(r, "c");
    moveDown(r, "a");
    rankOption(r, "d");
    removeOption(r, "b");
    expect(r).toEqual(before);
  });

  it("writes ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd"]);
  });
});

describe("dashboard text", () => {
  it("says which polls are on the page, with an en dash", () => {
    expect(showingText(1, 20, 20, 120)).toBe("Showing 1–20 of 120 polls");
    expect(showingText(2, 20, 20, 120)).toBe("Showing 21–40 of 120 polls");
    expect(showingText(6, 20, 20, 120)).toBe("Showing 101–120 of 120 polls");
    expect(showingText(1, 20, 1, 1)).toBe("Showing 1–1 of 1 poll");
    expect(showingText(1, 20, 20, 1200)).toBe("Showing 1–20 of 1,200 polls");
  });

  it("names the method", () => {
    expect(methodLabel(1)).toBe("One winner");
    expect(methodLabel(3)).toBe("STV, 3 seats");
  });

  it("lists every page up to seven, then gaps", () => {
    expect(pageItems(1, 6)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(pageItems(1, 12)).toEqual([1, 2, 3, 4, "gap", 12]);
    expect(pageItems(6, 12)).toEqual([1, "gap", 5, 6, 7, "gap", 12]);
    expect(pageItems(12, 12)).toEqual([1, "gap", 9, 10, 11, 12]);
  });

  it("reads the page from the URL", () => {
    expect(pageParam("2")).toBe(2);
    expect(pageParam(["3", "4"])).toBe(3);
    expect(pageParam("0")).toBe(1);
    expect(pageParam("1.5")).toBe(1);
    expect(pageParam("abc")).toBe(1);
    expect(pageParam(undefined)).toBe(1);
  });
});

describe("organizer presets", () => {
  it("are exactly the presets the services accept", () => {
    expect(PRESETS.map((p) => p.id)).toEqual([...PRESET_IDS]);
  });

  it("each say what they do in one sentence", () => {
    for (const p of PRESETS) expect(p.sentence.match(/[.!?](\s|$)/g)).toHaveLength(1);
  });

  it("offer the engine's ranking limit", () => {
    for (const p of PRESETS) {
      const limit = ENGINE_PRESETS[p.id].maxRankingsAllowed;
      expect(p.maxRanks).toBe(typeof limit === "number" ? limit : null);
    }
  });

  it("fit the seats the services allow", () => {
    for (const p of PRESETS) {
      expect(presetFits(p, 1).ok).toBe(!MULTI_WINNER_ONLY.includes(p.id));
      expect(presetFits(p, 3).ok).toBe(!SINGLE_WINNER_ONLY.includes(p.id));
    }
  });
});
