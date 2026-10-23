import { describe, expect, it } from "vitest";
import { countBallots } from "@/components/count/countBallots";
import { OVERVOTE_EXAMPLE, TIE_EXAMPLE } from "@/components/count/examples";
import { formatBallotError, parseBallotCsv } from "@/lib/ballotCsv";

describe("parseBallotCsv", () => {
  it("reads one ranking per line, candidates in order of first appearance", () => {
    const parsed = parseBallotCsv("Pizza,Tacos,Sushi\nTacos , Pizza\n");
    expect(parsed.errors).toEqual([]);
    expect(parsed.candidates).toEqual(["Pizza", "Tacos", "Sushi"]);
    expect(parsed.ballots).toEqual([
      { ranking: [["Pizza"], ["Tacos"], ["Sushi"]], count: 1 },
      { ranking: [["Tacos"], ["Pizza"]], count: 1 },
    ]);
    expect(parsed.totalBallots).toBe(2);
  });

  it("reads A|B as an overvote at that rank", () => {
    expect(parseBallotCsv("Ash|Cal,Ash").ballots).toEqual([{ ranking: [["Ash", "Cal"], ["Ash"]], count: 1 }]);
  });

  it("reads an empty field as a skipped rank and drops trailing ones", () => {
    expect(parseBallotCsv("Pizza,,Sushi,,").ballots).toEqual([{ ranking: [["Pizza"], [], ["Sushi"]], count: 1 }]);
  });

  it("takes a trailing xN as a count and merges identical rankings", () => {
    const parsed = parseBallotCsv("Pizza,Tacos x3\nPizza,Tacos\nTacos ×2");
    expect(parsed.ballots).toEqual([
      { ranking: [["Pizza"], ["Tacos"]], count: 4 },
      { ranking: [["Tacos"]], count: 2 },
    ]);
    expect(parsed.totalBallots).toBe(6);
  });

  it("skips blank lines and # notes, and keeps quoted names whole", () => {
    const parsed = parseBallotCsv('# a note\n\n"Peltola, Mary S.","Begich, Nick"\n"A|B" , C');
    expect(parsed.errors).toEqual([]);
    expect(parsed.candidates).toEqual(["Peltola, Mary S.", "Begich, Nick", "A|B", "C"]);
  });

  it("numbers every bad line", () => {
    const parsed = parseBallotCsv(['Pizza,Tacos', 'Ash|,Bea', 'Pizza x0', 'exhausted,Pizza', '"Open quote,Pizza', 'Ash|Ash', 'Tacos x1.5'].join("\n"));
    expect(parsed.errors.map((e) => e.line)).toEqual([2, 3, 4, 5, 6, 7]);
    expect(parsed.errors.map(formatBallotError)).toEqual([
      'Line 2: rank 1 has an empty name next to "|"; put a name on both sides.',
      'Line 3: the count after "x" must be from 1 to 1,000,000,000.',
      'Line 4: "exhausted" is a reserved word in the count; give this candidate another name.',
      "Line 5: a quote is opened but never closed.",
      "Line 6: rank 1 marks Ash twice; an overvote needs two different names.",
      'Line 7: the count after "x" must be a whole number, like x3.',
    ]);
  });

  it("asks for a ballot when there is none", () => {
    expect(parseBallotCsv("# nothing here\n").errors.map(formatBallotError)).toEqual(["Paste at least one ballot."]);
  });
});

describe("the overvote example", () => {
  const parsed = parseBallotCsv(OVERVOTE_EXAMPLE);

  it("parses cleanly", () => {
    expect(parsed.errors).toEqual([]);
    expect(parsed.totalBallots).toBe(22);
  });

  it("elects Bea under New York City rules, where an overvote ends the ballot", () => {
    const outcome = countBallots(parsed, "nyc", 1);
    if (!outcome.ok) throw new Error(outcome.message);
    expect(outcome.view.winners).toEqual(["Bea"]);
    expect(outcome.view.rounds.at(-1)!.tally).toEqual({ Bea: "10", Ash: "8" });
    expect(outcome.view.rounds[0]!.inactive.overvotes).toBe("4");
  });

  it("elects Ash under Minneapolis rules, where the overvoted rank is skipped", () => {
    const outcome = countBallots(parsed, "minneapolis-irv", 1);
    if (!outcome.ok) throw new Error(outcome.message);
    expect(outcome.view.winners).toEqual(["Ash"]);
    expect(outcome.view.rounds.at(-1)!.tally).toEqual({ Bea: "10", Ash: "12" });
    expect(outcome.view.pairwise.condorcetWinner).toBe("Ash");
  });
});

describe("counts that can't run", () => {
  it("calls a paste of empty ranks blank instead of counting candidates and seats", () => {
    expect(countBallots(parseBallotCsv(",,,"), "recount-standard", 1)).toEqual({ ok: false, message: "Every ballot is blank, so there is nothing to count." });
    expect(countBallots(parseBallotCsv("Ash"), "recount-standard", 3)).toEqual({
      ok: false,
      message: "There is 1 candidate for 3 seats; add candidates or lower the seats.",
    });
  });
});

describe("the tie example", () => {
  it("ties Bea and Cal for last in round 1", () => {
    const outcome = countBallots(parseBallotCsv(TIE_EXAMPLE), "recount-standard", 1);
    if (!outcome.ok) throw new Error(outcome.message);
    expect(outcome.view.rounds[0]!.tally).toEqual({ Ash: "4", Bea: "3", Cal: "3" });
    expect(outcome.view.rounds).toHaveLength(2);
    expect(["Bea", "Cal"]).toContain(outcome.view.winners[0]);
  });
});
