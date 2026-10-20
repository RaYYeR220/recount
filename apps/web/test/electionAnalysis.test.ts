import { describe, expect, it } from "vitest";
import { getElectionAnalysis } from "@/server/electionAnalysis";
import { ELECTIONS_DIR, getElection } from "@/server/elections";

describe("getElectionAnalysis", () => {
  it("finds Burlington 2009's Condorcet winner, whom ranked choice did not elect", async () => {
    const [a, replay] = await Promise.all([getElectionAnalysis("burlington-2009-mayor"), getElection("burlington-2009-mayor")]);
    expect(replay.winners).toEqual(["Bob Kiss"]);
    expect(a.pairwise.condorcetWinner).toBe("Andy Montroll");
    expect(a.pluralityWinner).toBe("Kurt Wright");
    expect(a.pairwise.matrix["Andy Montroll"]!["Bob Kiss"]).toBe(4068);
    expect(a.pairwise.matrix["Bob Kiss"]!["Andy Montroll"]).toBe(3476);
    expect(a.writeIns).toEqual(["Write-in"]);
  });

  it("keys Alaska by the report's names and leaves the excluded write-in out", async () => {
    const a = await getElectionAnalysis("alaska-2022-special");
    expect(a.contenders).toEqual(["Peltola, Mary S.", "Palin, Sarah", "Begich, Nick"]);
    expect(a.pairwise.condorcetWinner).toBe("Begich, Nick");
    expect(a.official?.winners).toEqual(["Peltola, Mary S."]);
  });

  it("carries the official rounds the replay is compared with", async () => {
    const [a, replay] = await Promise.all([getElectionAnalysis("nyc-2025-dem-mayor"), getElection("nyc-2025-dem-mayor")]);
    expect(a.official?.rounds.at(-1)?.tally).toEqual({ "Zohran Kwame Mamdani": "573169", "Andrew M. Cuomo": "443229" });
    expect(a.pairwise.condorcetWinner).toBe("Zohran Kwame Mamdani");
    expect(a.contenders).toEqual(replay.candidates);
    expect(a.writeIns).toEqual(["Write-ins"]);
  });

  it("answers not_found for an unknown slug", async () => {
    await expect(getElectionAnalysis("atlantis-1999", ELECTIONS_DIR)).rejects.toMatchObject({ code: "not_found" });
  });
});
