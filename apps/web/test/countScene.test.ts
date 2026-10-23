import { describe, expect, it } from "vitest";
import { captionText } from "@/lib/countCaptions";
import { buildCountScene, INACTIVE_TRAY, pickBallotsPerChit, trayGroup, type CountRound, type CountScene } from "@/lib/countScene";
import { toUnits } from "@/lib/votes";
import { ELECTIONS_DIR, getElection } from "@/server/elections";
import { tabulatePoll } from "@/server/results/tabulatePoll";
import { COMMITTEE_BALLOTS, LUNCH_BALLOTS } from "@/server/seed/showcase";

const HASH = "0".repeat(64);

function count(title: string, labels: string[], rows: string[][], seats: number) {
  const { results } = tabulatePoll({ title, presetId: "recount-standard", seats, maxRanks: null }, { labels, rows, sha256: HASH }, null);
  return results;
}

const lunch = count("Lunch, closed", ["Pizza", "Tacos", "Sushi"], LUNCH_BALLOTS, 1);
const committee = count("Residents' committee, 2 seats", ["Ana", "Ben", "Cleo", "Dev", "Eli"], COMMITTEE_BALLOTS, 2);

const lunchScene = buildCountScene({ rounds: lunch.rounds, options: lunch.candidates, seats: 1 });
const committeeScene = buildCountScene({ rounds: committee.rounds, options: committee.candidates, seats: 2 });

/** Weight lying in each tray in one round, in chit units. */
function trayWeights(scene: CountScene, round: number): Map<string, number> {
  const out = new Map<string, number>();
  for (const spot of scene.spots[round]!) if (spot) out.set(spot.tray, (out.get(spot.tray) ?? 0) + spot.weight);
  return out;
}

function trayIdOf(scene: CountScene, label: string): string {
  return scene.trays.find((t) => t.members.includes(label))!.id;
}

function engineValue(round: CountRound, label: string, dp: number): number {
  if (label === INACTIVE_TRAY) return Object.values(round.inactive).reduce((a, v) => a + Number(toUnits(v, dp)), 0) / 10 ** dp;
  return round.tally[label] === undefined ? 0 : Number(toUnits(round.tally[label]!, dp)) / 10 ** dp;
}

describe("buildCountScene: the lunch poll", () => {
  it("counts what the engine counts", () => {
    expect(lunch.rounds.map((r) => r.tally)).toEqual([
      { Pizza: "6", Tacos: "4", Sushi: "3" },
      { Pizza: "6", Tacos: "7" },
    ]);
    expect(lunchScene.ballotsPerChit).toBe(1);
    expect(lunchScene.wholeChits).toBe(13);
  });

  it("keeps all 13 chits on the table in every round", () => {
    for (const row of lunchScene.spots) {
      expect(row.filter(Boolean)).toHaveLength(13);
      expect(row.every((s) => s?.weight === 1)).toBe(true);
    }
    expect(lunchScene.chits.every((c) => c.parent === null)).toBe(true);
  });

  it("puts one chit per ballot in each tray, round by round", () => {
    lunchScene.rounds.forEach((round, i) => {
      const weights = trayWeights(lunchScene, i);
      for (const label of ["Pizza", "Tacos", "Sushi"]) {
        expect(weights.get(trayIdOf(lunchScene, label)) ?? 0).toBe(engineValue(lunch.rounds[i]!, label, 0));
        const tray = round.trays[trayIdOf(lunchScene, label)]!;
        expect(tray.raw).toBe(lunch.rounds[i]!.tally[label] ?? "0");
      }
    });
    const tacos = trayIdOf(lunchScene, "Tacos");
    expect(lunchScene.rounds[1]!.trays[tacos]).toMatchObject({ tally: "7", delta: "+3", state: "elected" });
  });

  it("moves Sushi's three chits to Tacos and keeps their colour", () => {
    const sushi = trayIdOf(lunchScene, "Sushi");
    const tacos = trayIdOf(lunchScene, "Tacos");
    const moved = lunchScene.chits.filter((c) => lunchScene.spots[0]![c.id]!.tray === sushi);
    expect(moved).toHaveLength(3);
    for (const c of moved) {
      expect(lunchScene.spots[1]![c.id]!.tray).toBe(tacos);
      expect(c.chit).toBe(2);
    }
  });

  it("says none on an empty inactive tray once nothing more can go inactive", () => {
    const open = buildCountScene({ rounds: lunch.rounds, options: lunch.candidates, provisional: true });
    expect(lunchScene.rounds.map((r) => r.trays[INACTIVE_TRAY]!.meta)).toEqual(["none", "none"]);
    expect(open.rounds.map((r) => r.trays[INACTIVE_TRAY]!.meta)).toEqual(["none yet", "none yet"]);
    expect(committeeScene.rounds[0]!.trays[INACTIVE_TRAY]!.meta).toBe("none yet");
  });

  it("writes captions from the rounds", () => {
    expect(lunchScene.rounds.map((r) => r.label)).toEqual(["First choices", "Final round"]);
    expect(captionText(lunchScene.rounds[0]!.caption)).toBe(
      "Round 1, first choices. 13 ballots count. Pizza leads with 6, short of the 7 needed, so the count goes on.",
    );
    expect(captionText(lunchScene.rounds[1]!.caption)).toBe(
      "Round 2, Sushi is eliminated. All 3 of Sushi's ballots move to Tacos. Tacos has 7 of 13 ballots, more than half, and wins.",
    );
  });
});

describe("buildCountScene: the committee poll (STV, 2 seats)", () => {
  it("matches the engine's six rounds", () => {
    expect(committee.rounds).toHaveLength(6);
    expect(committee.winners).toEqual(["Ana", "Ben"]);
    expect(committee.rounds[0]!.transfers).toEqual([{ from: "Ana", to: { Ben: "1.8000", Cleo: "1.2000" } }]);
    expect(committeeScene.dp).toBe(4);
  });

  it("keeps the 20 whole chits through every round", () => {
    for (const row of committeeScene.spots) {
      const whole = committeeScene.chits.filter((c) => c.parent === null && row[c.id]);
      expect(whole).toHaveLength(20);
    }
  });

  it("lays exactly the engine's tally in every tray, every round", () => {
    committee.rounds.forEach((round, i) => {
      const weights = trayWeights(committeeScene, i);
      for (const label of [...committee.candidates, INACTIVE_TRAY]) {
        const tray = label === INACTIVE_TRAY ? INACTIVE_TRAY : trayIdOf(committeeScene, label);
        expect(weights.get(tray) ?? 0).toBeCloseTo(engineValue(round, label, 4), 9);
      }
    });
  });

  it("sends Ana's surplus as slivers that sum to the transfers", () => {
    const slivers = committeeScene.chits.filter((c) => c.parent !== null);
    expect(slivers).toHaveLength(10);
    const sum = (label: string) =>
      slivers.filter((c) => committeeScene.spots[1]![c.id]!.tray === trayIdOf(committeeScene, label)).reduce((a, c) => a + committeeScene.spots[1]![c.id]!.weight, 0);
    expect(sum("Ben")).toBeCloseTo(1.8, 12);
    expect(sum("Cleo")).toBeCloseTo(1.2, 12);
    for (const c of slivers) {
      expect(c.born).toBe(1);
      expect(c.chit).toBe(0);
      expect(committeeScene.spots[0]![c.id]).toBeNull();
    }
    const ana = trayIdOf(committeeScene, "Ana");
    expect(trayWeights(committeeScene, 1).get(ana)).toBeCloseTo(7, 9);
  });

  it("labels round 6 as the trailing round after the seats fill", () => {
    const last = committeeScene.rounds[5]!;
    expect(last.trailing).toBe(true);
    expect(committeeScene.rounds.filter((r) => r.trailing)).toHaveLength(1);
    expect(last.label).toBe("Seats filled; surplus set aside");
    expect(captionText(last.caption)).toMatch(/^Round 6, seats filled; surplus set aside\. /);
  });

  it("names seats and eliminations on the plaques", () => {
    const at = (round: number, label: string) => committeeScene.rounds[round]!.trays[trayIdOf(committeeScene, label)]!;
    expect(at(0, "Ana")).toMatchObject({ state: "elected", seat: 1, meta: "Elected in round 1" });
    expect(at(1, "Ana")).toMatchObject({ tally: "7", delta: "−3", meta: "−3" });
    expect(at(1, "Ben")).toMatchObject({ tally: "5.8000", delta: "+1.8000", state: "continuing" });
    expect(at(5, "Ben")).toMatchObject({ state: "elected", seat: 2, meta: "Elected in round 5" });
    expect(at(5, "Cleo")).toMatchObject({ tally: "0", state: "out", meta: "Eliminated in round 4" });
    expect(committeeScene.rounds[5]!.trays[INACTIVE_TRAY]).toMatchObject({ tally: "6.2000", meta: "no choices left" });
  });

  it("captions the surplus and the quota", () => {
    expect(captionText(committeeScene.rounds[0]!.caption)).toBe("Round 1, first choices. Ana reaches the quota of 7 with 10 and is elected.");
    expect(captionText(committeeScene.rounds[1]!.caption)).toBe(
      "Round 2, Ana's surplus moves on. Ana's surplus of 3 moves on at 0.3000 a vote: 1.8000 to Ben and 1.2000 to Cleo.",
    );
    expect(captionText(committeeScene.rounds[4]!.caption)).toBe(
      "Round 5, Cleo is eliminated. All 6.2000 of Cleo's votes have no choices left and go inactive. Only as many options remain as seats, so Ben is elected with 6.8000.",
    );
  });
});

describe("buildCountScene: certified replays", () => {
  it("lays NYC 2025 out at 2,500 ballots a chit, minor candidates sharing a tray", async () => {
    const e = await getElection("nyc-2025-dem-mayor", ELECTIONS_DIR);
    const minor = e.candidates.slice(3, 11);
    const scene = buildCountScene({
      rounds: e.rounds,
      options: e.candidates,
      ballotsPerChit: 2500,
      groups: [trayGroup("others", "Adams", minor)],
      shortLabels: { "Zohran Kwame Mamdani": "Mamdani", "Andrew M. Cuomo": "Cuomo", "Brad Lander": "Lander" },
      noun: "candidate",
    });
    expect(scene.trays.map((t) => t.label)).toEqual(["Zohran Kwame Mamdani", "Andrew M. Cuomo", "Brad Lander", "Adams & 7 more", "Write-ins", "Inactive"]);
    expect(scene.trays.find((t) => t.label === "Write-ins")!.chit).toBe("writein");
    for (const row of scene.spots) expect(row.filter(Boolean)).toHaveLength(scene.wholeChits);
    scene.rounds.forEach((round, i) => {
      const weights = trayWeights(scene, i);
      for (const tray of scene.trays) expect(Math.abs((weights.get(tray.id) ?? 0) - Number(round.trays[tray.id]!.raw) / 2500)).toBeLessThan(1);
    });
    const mamdani = scene.trays[0]!.id;
    expect(scene.rounds[2]!.trays[mamdani]).toMatchObject({ tally: "573,169", state: "elected" });
    expect(captionText(scene.rounds[1]!.caption)).toMatch(/^Round 2, write-ins are eliminated\. Their 1,581 ballots move on: /);
    expect(captionText(scene.rounds[2]!.caption)).toContain("Mamdani has 573,169 of 1,016,398 ballots, more than half, and wins.");
  });

  it("sets Portland's last surplus aside in the trailing round", async () => {
    const e = await getElection("portland-2024-d1", ELECTIONS_DIR);
    const scene = buildCountScene({ rounds: e.rounds, options: e.candidates, seats: e.seats, noun: "candidate" });
    const last = scene.rounds.at(-1)!;
    expect(scene.rounds).toHaveLength(17);
    expect(last.trailing).toBe(true);
    expect(last.label).toBe("Seats filled; surplus set aside");
    expect(captionText(last.caption)).toMatch(/^Round 17, seats filled; surplus set aside\. Every seat is filled, so .+'s surplus of [\d,.]+ is set aside instead of moving on\.$/);
    expect(last.incoming.flatMap((t) => t.to).every((to) => to.setAside)).toBe(true);

    // Every sliver of a surplus lands where the engine sent it, to the vote.
    const surplusRound = scene.rounds.findIndex((r, i) => i > 0 && !r.trailing && r.incoming.some((t) => t.kind === "surplus"));
    const transfer = scene.rounds[surplusRound]!.incoming.find((t) => t.kind === "surplus")!;
    for (const to of transfer.to.filter((x) => x.tray)) {
      const slivers = scene.chits.filter((c) => c.born === surplusRound && scene.spots[surplusRound]![c.id]!.tray === to.tray);
      const votes = slivers.reduce((a, c) => a + scene.spots[surplusRound]![c.id]!.weight, 0) * scene.ballotsPerChit;
      expect(votes).toBeCloseTo(Number(to.amount), 6);
    }
  });
});

describe("pickBallotsPerChit", () => {
  it("picks round numbers that keep the table readable", () => {
    expect(pickBallotsPerChit(13)).toBe(1);
    expect(pickBallotsPerChit(500)).toBe(5);
    expect(pickBallotsPerChit(1_071_730)).toBe(5000);
    expect(pickBallotsPerChit(1_071_730, 480)).toBe(2500);
  });
});
