import { describe, expect, it } from "vitest";
import { matchLabel, reportName } from "@/components/elections/matchLabel";
import { inactiveSummary, whyItWon } from "@/lib/countStory";
import { captionText } from "@/lib/countCaptions";
import { findTies } from "@/lib/countTies";
import { parseCsv } from "@/lib/csv";
import { personName, surname } from "@/lib/names";
import { comparePollRecount, compareElectionRecount, figuresLine, largestGap, pollMatchLine, type PollRecount } from "@/lib/recount";
import { buildCvr } from "@/server/results/cvr";
import { tabulatePoll } from "@/server/results/tabulatePoll";
import { COMMITTEE_BALLOTS, LUNCH_BALLOTS } from "@/server/seed/showcase";

const LUNCH = ["Pizza", "Tacos", "Sushi"];
const options = LUNCH.map((label) => ({ id: label, label }));

function lunchCvr() {
  return buildCvr(options, LUNCH_BALLOTS.map((labels) => ({ ranking: labels })), null);
}

describe("the browser recount of a poll", () => {
  it("reads back the exact rows the CVR endpoint writes", () => {
    const cvr = buildCvr(options.concat({ id: "x", label: 'Say "cheese", please' }), [{ ranking: ['x', "Pizza"] }, { ranking: ["Tacos"] }], null);
    expect(parseCsv(cvr.csv)).toEqual([cvr.header, ...cvr.rows]);
  });

  it("counts the CSV to the published result and says so in the contract's words", () => {
    const cvr = lunchCvr();
    const published = tabulatePoll({ title: "Lunch", presetId: "recount-standard", seats: 1, maxRanks: null }, cvr, null).results;
    const [, ...rows] = parseCsv(cvr.csv);
    const again = tabulatePoll({ title: "Recount", presetId: "recount-standard", seats: 1, maxRanks: null }, { labels: LUNCH, rows, sha256: cvr.sha256 }, null).results;
    const recount: PollRecount = { kind: "poll", sha256: cvr.sha256, rows: rows.length, winners: again.winners, rounds: again.rounds };
    expect(comparePollRecount({ sha256: published.cvrSha256, winners: published.winners, rounds: published.rounds }, recount)).toEqual([]);
    expect(pollMatchLine(1, recount)).toBe(`Recount matches: same winner, same 2 rounds, CVR SHA-256 ${cvr.sha256.slice(0, 12)}`);
  });

  it("names every difference when the record was altered", () => {
    const cvr = lunchCvr();
    const published = tabulatePoll({ title: "Lunch", presetId: "recount-standard", seats: 1, maxRanks: null }, cvr, null).results;
    const recount: PollRecount = {
      kind: "poll",
      sha256: "f".repeat(64),
      rows: 13,
      winners: ["Pizza"],
      rounds: [{ ...published.rounds[0]!, tally: { ...published.rounds[0]!.tally, Pizza: "7" } }],
    };
    expect(comparePollRecount({ sha256: cvr.sha256, winners: published.winners, rounds: published.rounds }, recount)).toEqual([
      `The cast-vote record hashes to ffffffffffff…, but the page published ${cvr.sha256.slice(0, 12)}….`,
      "The recount elects Pizza; the page published Tacos.",
      "The recount takes 1 round; the page published 2 rounds.",
      "Round 1, Pizza: the recount has 7, the page published 6.",
    ]);
  });
});

describe("the browser recount of a replay", () => {
  it("compares figure counts in the words of each source", () => {
    expect(figuresLine(159, 0)).toBe("159 of 159 figures match the official count");
    expect(figuresLine(36, 0, reportName("minneapolis-irv"))).toBe("36 of 36 figures match the city's published round results");
    const published = { sha256: "a".repeat(64), winners: ["Bob Kiss"], rounds: 3, cells: 19, mismatches: 2, against: "the official count" };
    const recount = { kind: "election" as const, sha256: "a".repeat(64), totalBallots: 8984, winners: ["Bob Kiss"], rounds: 3, cells: 19, mismatches: [] };
    expect(compareElectionRecount(published, recount)).toEqual([
      "In this browser 19 of 19 figures match the official count; the page published 17 of 19 figures match the official count.",
    ]);
  });

  it("labels a replay by what it matches", () => {
    const off = [{ round: 3, candidate: "Kurt Wright", expected: "4061", actual: "4060" }];
    expect(matchLabel("nyc", [])).toEqual({ tone: "match", text: "Matches the certified count" });
    expect(matchLabel("portland-stv", [])).toEqual({ tone: "match", text: "Matches the certified count" });
    expect(matchLabel("minneapolis-stv", [])).toEqual({ tone: "match", text: "Matches the city's published round results" });
    expect(matchLabel("burlington-2009", off)).toEqual({ tone: "warn", text: "Within 1 vote of the official count" });
    expect(largestGap([...off, { round: 2, candidate: "Palin, Sarah", expected: "75799", actual: "75781" }])).toBe(18);
  });
});

describe("count stories", () => {
  const lunch = tabulatePoll({ title: "Lunch", presetId: "recount-standard", seats: 1, maxRanks: null }, { labels: LUNCH, rows: LUNCH_BALLOTS, sha256: "0".repeat(64) }, null).results;
  const committee = tabulatePoll(
    { title: "Committee", presetId: "recount-standard", seats: 2, maxRanks: null },
    { labels: ["Ana", "Ben", "Cleo", "Dev", "Eli"], rows: COMMITTEE_BALLOTS, sha256: "0".repeat(64) },
    null,
  ).results;

  it("tells why Tacos won the lunch poll", () => {
    expect(whyItWon({ rounds: lunch.rounds, winners: lunch.winners, seats: 1 }).map(captionText)).toEqual([
      "Tacos won with 7 of 13 ballots in round 2.",
      "Pizza led the first choices with 6, short of the 7 needed. Sushi was eliminated and its 3 ballots moved on: 3 to Tacos.",
      "Tacos came from behind: second on first choices, it won on later preferences.",
    ]);
    expect(captionText(inactiveSummary(lunch.rounds, "ballots"))).toBe("No ballots went inactive: every one counted for an option still in the race, to the last round.");
    expect(findTies(lunch.rounds)).toEqual([]);
  });

  it("tells how the committee's two seats filled", () => {
    const story = whyItWon({ rounds: committee.rounds, winners: committee.winners, seats: 2 }).map(captionText);
    expect(story[0]).toBe("Ana reached the quota of 7 in round 1 with 10 first choices. The surplus of 3 moved on at 0.3000 a vote: 1.8000 to Ben and 1.2000 to Cleo.");
    expect(story.at(-1)).toBe("Round 6 is the extra round RCTab reports after the last seat fills; nothing moves in it.");
  });
});

describe("names", () => {
  it("reads report names the way people do", () => {
    expect(personName("Peltola, Mary S.")).toBe("Mary S. Peltola");
    expect(personName("Zohran Kwame Mamdani")).toBe("Zohran Kwame Mamdani");
    expect(surname("Michael (Mike) Sands")).toBe("Sands");
    expect(surname("Martin Luther King Jr.")).toBe("King");
    expect(surname("Begich, Nick")).toBe("Begich");
  });
});
