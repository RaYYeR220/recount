import { presetRules, tabulate } from "@recount/engine";
import { describe, expect, it } from "vitest";
import { countBallots } from "@/components/count/countBallots";
import { parseBallotCsv } from "@/lib/ballotCsv";
import { captionText } from "@/lib/countCaptions";
import { buildCountScene, type CountScene } from "@/lib/countScene";
import { whyItWon } from "@/lib/countStory";
import { findTies, tieBreak, tieBreakPhrase } from "@/lib/countTies";
import { serializeRounds } from "@/server/results/serialize";
import { tabulatePoll } from "@/server/results/tabulatePoll";
import { COMMITTEE_BALLOTS, LUNCH_BALLOTS } from "@/server/seed/showcase";

const repeat = (count: number, ranking: string[]) => Array.from({ length: count }, () => ranking);
const CVR_SEED = "seeded from the cast-vote record's SHA-256";
const story = (...args: Parameters<typeof whyItWon>) => whyItWon(...args).map(captionText);
const captions = (scene: CountScene) => scene.rounds.map((r) => captionText(r.caption));
const meta = (scene: CountScene, round: number, label: string) => scene.rounds[round]!.trays[scene.trays.find((t) => t.label === label)!.id]!.meta;

/**
 * The live offsite poll as QA found it, 14 ballots: Tallinn and Valencia tie for
 * last in round 2 (level in round 1 too, so a seeded draw), then Lisbon and
 * Valencia finish 7 to 7 against 8 needed and round 2's counts pick Lisbon.
 */
const OFFSITE = [
  ["Lisbon", "Valencia"],
  ["Kraków", "Lisbon"],
  ["Lisbon"],
  ["Tallinn", "Kraków", "Lisbon"],
  ["Valencia", "Lisbon", "Kraków"],
  ...repeat(3, ["Lisbon"]),
  ...repeat(3, ["Tallinn", "Valencia"]),
  ...repeat(3, ["Valencia", "Tallinn"]),
];

function countPoll(labels: string[], rows: string[][], seats = 1, sha256 = "f".repeat(64)) {
  const { results } = tabulatePoll({ title: "Poll", presetId: "recount-standard", seats, maxRanks: null }, { labels, rows, sha256 }, null);
  return results;
}

function scene(results: ReturnType<typeof countPoll>, provisional: boolean, seed = CVR_SEED) {
  return buildCountScene({ rounds: results.rounds, options: results.candidates, seats: results.seats, provisional, tiebreak: { rules: results.rules, seed } });
}

describe("a tie in the final round", () => {
  const offsite = countPoll(["Lisbon", "Kraków", "Tallinn", "Valencia"], OFFSITE);

  it("is the engine's count: 7 to 7 with 8 needed, Lisbon elected", () => {
    expect(offsite.rounds.map((r) => r.tally)).toEqual([
      { Lisbon: "5", Kraków: "1", Tallinn: "4", Valencia: "4" },
      { Lisbon: "6", Tallinn: "4", Valencia: "4" },
      { Lisbon: "7", Valencia: "7" },
    ]);
    expect(offsite.rounds[2]!.threshold).toBe("8");
    expect(offsite.winners).toEqual(["Lisbon"]);
  });

  it("finds both ties and how the rules broke them", () => {
    const ties = findTies(offsite.rounds);
    expect(ties).toEqual([
      { kind: "last", round: 2, tied: ["Tallinn", "Valencia"], picked: ["Tallinn"], at: "4" },
      { kind: "seat", round: 3, tied: ["Lisbon", "Valencia"], picked: ["Lisbon"], at: "7" },
    ]);
    expect(tieBreak(ties[0]!, offsite.rounds, offsite.rules)).toEqual({ by: "draw", among: ["Tallinn", "Valencia"], levelBefore: 1 });
    expect(tieBreak(ties[1]!, offsite.rounds, offsite.rules)).toEqual({ by: "previousRound", round: 2, counts: [["Lisbon", "6"], ["Valencia", "4"]] });
    expect(tieBreakPhrase(ties[0]!, offsite.rounds, offsite.rules, CVR_SEED)).toBe(`by a draw ${CVR_SEED}, as they were level in round 1 too`);
    expect(tieBreakPhrase(ties[1]!, offsite.rounds, offsite.rules, CVR_SEED)).toBe("on round 2's counts, where Lisbon had 6 and Valencia 4");
  });

  it("tells the tie, never a majority", () => {
    const closed = story({ rounds: offsite.rounds, winners: offsite.winners, seats: 1 });
    expect(closed[0]).toBe("Lisbon and Valencia finished level in round 3 with 7 of 14 ballots each, short of the 8 needed, and Lisbon won on the tiebreak.");
    const open = story({ rounds: offsite.rounds, winners: offsite.winners, seats: 1, provisional: true });
    expect(open[0]).toBe(
      "Lisbon and Valencia are level in round 3 of the count so far with 7 of 14 ballots each, short of the 8 needed; Lisbon leads only on the tiebreak.",
    );
    for (const text of [...closed, ...open]) expect(text).not.toMatch(/majority|more than half|reached/);
  });

  it("captions both ties with the tiebreak that settled them", () => {
    const [, second, third] = captions(scene(offsite, false));
    expect(second).toContain(`Tallinn and Valencia are level for last with 4; the tiebreak eliminates Tallinn by a draw ${CVR_SEED}, as they were level in round 1 too.`);
    expect(third).toContain(
      "Lisbon and Valencia have 7 of 14 ballots each, short of the 8 needed. The tiebreak elects Lisbon on round 2's counts, where Lisbon had 6 and Valencia 4.",
    );
    expect(third).not.toContain("wins");
  });

  it("names the leader on the tiebreak, not a winner, while the poll is open", () => {
    const live = scene(offsite, true);
    expect(captions(live)[2]).toContain("The tiebreak puts Lisbon ahead on round 2's counts");
    expect(meta(live, 2, "Lisbon")).toBe("ahead on tiebreak");
    expect(meta(live, 2, "Valencia")).toBe("behind on tiebreak");
    expect(meta(live, 1, "Tallinn")).toBe("lost the tiebreak");
    for (const r of live.rounds) {
      expect(captionText(r.caption)).not.toMatch(/\b(wins|elects|elected)\b/);
      for (const t of Object.values(r.trays)) expect(t.meta).not.toMatch(/elected/i);
    }
    expect(meta(scene(offsite, false), 2, "Lisbon")).toBe("won the tiebreak");
  });
});

describe("a tie in round 1", () => {
  const outcome = countBallots(parseBallotCsv("A,B\nB,A"), "recount-standard", 1);
  if (!outcome.ok) throw new Error(outcome.message);
  const { view } = outcome;

  it("is settled by the draw alone: round 1 has no previous round", () => {
    const [tie] = findTies(view.rounds);
    expect(tie).toEqual({ kind: "seat", round: 1, tied: ["B", "A"], picked: ["B"], at: "1" });
    expect(tieBreak(tie!, view.rounds, view.rules)).toEqual({ by: "draw", among: ["B", "A"], levelBefore: null });
    expect(tieBreakPhrase(tie!, view.rounds, view.rules)).toBe("by a draw with seed 0");
  });

  it("says B won on the tiebreak, not on a majority of first choices", () => {
    expect(story({ rounds: view.rounds, winners: view.winners, seats: 1 })).toEqual([
      "B and A finished level on first choices with 1 of 2 ballots each, short of the 2 needed, and B won on the tiebreak.",
    ]);
    const scene = buildCountScene({ rounds: view.rounds, options: view.options, tiebreak: { rules: view.rules } });
    expect(captions(scene)).toEqual([
      "Round 1, first choices. 2 ballots count. B and A have 1 of 2 ballots each, short of the 2 needed. The tiebreak elects B by a draw with seed 0.",
    ]);
  });

  it("words a tie for last in round 1 as a draw too", () => {
    const tie = countBallots(parseBallotCsv("Ash x4\nBea,Cal x3\nCal,Bea x3"), "recount-standard", 1);
    if (!tie.ok) throw new Error(tie.message);
    const [last] = findTies(tie.view.rounds);
    expect(last).toMatchObject({ kind: "last", round: 1, at: "3" });
    expect(tieBreakPhrase(last!, tie.view.rounds, tie.view.rules)).toBe("by a draw with seed 0");
  });
});

describe("a win below the threshold without a tie", () => {
  // Minneapolis fixes the threshold in round 1; C's two ballots then run out of choices.
  const rules = presetRules("minneapolis-irv", 1);
  const result = tabulate({
    candidates: ["A", "B", "C"].map((id) => ({ id, name: id })),
    ballots: [
      { ranking: [["A"]], count: 4 },
      { ranking: [["B"]], count: 3 },
      { ranking: [["C"]], count: 2 },
    ],
    rules,
  });
  const rounds = serializeRounds(result);

  it("elects A with 4 of 7 against 5 needed", () => {
    expect(rounds.at(-1)).toMatchObject({ tally: { A: "4", B: "3" }, threshold: "5", elected: ["A"] });
    expect(findTies(rounds)).toEqual([]);
  });

  it("says A had the most left, short of the threshold", () => {
    const told = story({ rounds, winners: result.winners, seats: 1 });
    expect(told[0]).toBe("A won with 4 of 7 ballots in round 2, short of the 5 needed but the most of the last two left.");
    const caption = captions(buildCountScene({ rounds, options: ["A", "B", "C"], tiebreak: { rules } })).at(-1)!;
    expect(caption).toContain("A has 4 of 7 ballots, short of the 5 needed but the most left, and wins.");
    for (const text of [...told, caption]) expect(text).not.toMatch(/majority|more than half/);
  });
});

describe("a majority", () => {
  const lunch = countPoll(["Pizza", "Tacos", "Sushi"], LUNCH_BALLOTS);

  it("still says more than half, and leads while the poll is open", () => {
    expect(findTies(lunch.rounds)).toEqual([]);
    expect(story({ rounds: lunch.rounds, winners: lunch.winners, seats: 1 })[0]).toBe("Tacos won with 7 of 13 ballots in round 2.");
    expect(captions(scene(lunch, false))[1]).toContain("Tacos has 7 of 13 ballots, more than half, and wins.");
    expect(captions(scene(lunch, true))[1]).toContain("Tacos has 7 of 13 ballots, more than half, and leads.");
  });

  it("never elects anyone in an open STV poll", () => {
    const committee = countPoll(["Ana", "Ben", "Cleo", "Dev", "Eli"], COMMITTEE_BALLOTS, 2);
    const live = scene(committee, true);
    expect(live.provisional).toBe(true);
    expect(meta(live, 0, "Ana")).toBe("Leading from round 1");
    expect(captionText(live.rounds[0]!.caption)).toBe("Round 1, first choices. Ana reaches the quota of 7 with 10 and leads for a seat.");
    expect(live.rounds[4]!.label).toBe("Ben ahead");
    expect(captionText(live.rounds[4]!.caption)).toMatch(/so Ben leads for a seat with 6\.8000\.$/);
    for (const r of live.rounds) expect(captionText(r.caption)).not.toMatch(/\belected\b/);
    expect(story({ rounds: committee.rounds, winners: committee.winners, seats: 2, provisional: true }).join(" ")).not.toMatch(/\belected\b/);
  });
});

describe("count nouns", () => {
  it("counts one first choice as one", () => {
    // Two ballots, two seats: the quota is 1.
    const one = countPoll(["Ana", "Ben", "Cleo"], [["Ana"], ["Ben"]], 2);
    expect(story({ rounds: one.rounds, winners: one.winners, seats: 2 })[0]).toBe("Ana reached the quota of 1 in round 1 with 1 first choice.");
  });
});
