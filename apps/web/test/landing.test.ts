import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Golden } from "@recount/engine";
import { beforeAll, describe, expect, it } from "vitest";
import { buildApiExample, lunchRequest } from "@/components/landing/apiExample";
import { buildAudit } from "@/components/landing/auditData";
import { buildHeroData, reportedRounds, surname, type HeroData } from "@/components/landing/heroData";
import { shareOf } from "@/components/landing/HeroPlaque";
import { buildLesson } from "@/components/landing/lessonData";
import { parseCsv, recountCvr } from "@/components/landing/recount";
import { matchLabel, personName } from "@/components/landing/replaysData";
import { compactJson } from "@/lib/compactJson";
import { buildCountScene } from "@/lib/countScene";
import { ELECTIONS_DIR, getElection, type ElectionReplay } from "@/server/elections";
import { showcaseCvr } from "@/server/seed/showcaseCvr";
import { tabulateInputSchema } from "@/server/tabulation";

const bytes = (text: string) => new TextEncoder().encode(text);

describe("the lunch vote's audit on the landing", () => {
  const audit = buildAudit();

  it("prints the CVR and hash the API serves for the seeded poll", () => {
    const served = showcaseCvr("lunch-closed");
    expect(audit.csv).toBe(served.csv);
    expect(audit.sha256).toBe(served.sha256);
    expect(audit.published).toEqual({ winners: ["Tacos"], rounds: 2, ballots: 13, sha256: served.sha256 });
    expect(audit.cvrUrl).toBe("/api/v1/polls/lunch-closed/cvr?format=csv");
  });

  it("shows the RCTab rounds as served, with only the seeding date folded away", () => {
    expect(audit.rctab).toContain('"config": { "contest": "Lunch, closed", … }');
    expect(audit.rctab).not.toContain('"date"');
    expect(audit.rctab).toMatch(/"elected": "Tacos"/);
    expect(audit.rctab).toMatch(/"Tacos": "7"/);
  });

  it("recounts to the published result from the CVR bytes", async () => {
    const out = await recountCvr(bytes(audit.csv), audit.poll, audit.published);
    expect(out).toEqual({
      ballots: 13,
      columns: 3,
      sha256: audit.sha256,
      hashMatches: true,
      winners: ["Tacos"],
      rounds: 2,
      countMatches: true,
    });
  });

  it("catches a CVR that was changed after it was published", async () => {
    const tampered = audit.csv.replace("Sushi,Tacos,", "Sushi,Pizza,");
    const out = await recountCvr(bytes(tampered), audit.poll, audit.published);
    expect(out.hashMatches).toBe(false);
    expect(out.winners).toEqual(["Pizza"]);
    expect(out.countMatches).toBe(false);
  });
});

describe("parseCsv", () => {
  it("reads quoted fields, doubled quotes, empty ranks and both line ends", () => {
    expect(parseCsv('Rank 1,Rank 2\r\n"Smith, Ann","Say ""hi"""\nPizza,\n')).toEqual([
      ["Rank 1", "Rank 2"],
      ["Smith, Ann", 'Say "hi"'],
      ["Pizza", ""],
    ]);
  });
});

describe("the hero", () => {
  let replay: ElectionReplay;
  let hero: HeroData;

  beforeAll(async () => {
    replay = await getElection("nyc-2025-dem-mayor");
    const golden = JSON.parse(await readFile(join(ELECTIONS_DIR, "goldens", "nyc-2025-dem-mayor.json"), "utf8")) as Golden;
    hero = buildHeroData(replay, golden, "/elections/nyc-2025-dem-mayor");
  });

  it("proves every certified figure from the ballots", () => {
    expect(hero.proof).toMatchObject({ publisher: "Board of Elections in the City of New York", matched: 28, cells: 28, ballots: "1,114,433" });
    expect(hero.proof.contest).toBe("Democratic primary for Mayor, June 24, 2025. Certified July 22, 2025.");
    expect(hero.proof.rows).toEqual([
      { label: "Mamdani", chit: 0, figure: "573,169", matches: true },
      { label: "Cuomo", chit: 1, figure: "443,229", matches: true },
      { label: "Inactive", chit: "inactive", figure: "55,332", matches: true },
    ]);
    expect(hero.proof.note).toContain("5,500 ballots overvoted in round 1");
  });

  it("counts inactive ballots the way the Board reports them", () => {
    const inactive = (i: number) => Object.values(hero.table.rounds[i]!.inactive).reduce((a, v) => a + Number(v), 0);
    expect([0, 1, 2].map(inactive)).toEqual([0, 649, 55_332]);
    expect(reportedRounds(replay.rounds, "cumulative")).toEqual(replay.rounds);
  });

  it("puts the leaders in trays of their own and everyone else in one", () => {
    expect(hero.table.groups).toEqual([{ id: "others", label: "Adams & 7 more", short: "Adams & 7", members: replay.candidates.slice(3, 11) }]);
    expect(hero.table.ballotsPerChit).toBe(2500);
    const scene = buildCountScene({ ...hero.table, noun: "candidate" });
    expect(scene.trays.map((t) => t.short)).toEqual(["Mamdani", "Cuomo", "Lander", "Adams & 7", "Write-ins", "Inactive"]);
    expect(scene.trays.map((t) => t.label)).toContain("Adams & 7 more");
    const last = scene.rounds.at(-1)!;
    expect(last.trays["option-0"]).toMatchObject({ tally: "573,169", state: "elected" });
    expect(last.trays.inactive!.tally).toBe("55,332");
    expect(scene.rounds.map((r) => r.label)).toEqual(["First choices", "Write-ins out", "Final round"]);
  });

  it("writes shares in exact units", () => {
    expect(shareOf("573169", "1016398", 0)).toBe("56.4%");
    expect(shareOf("469642", "1071730", 0)).toBe("43.8%");
    expect(shareOf("1", "0", 0)).toBe("0.0%");
  });

  it("names candidates by surname", () => {
    expect(surname("Zohran Kwame Mamdani")).toBe("Mamdani");
    expect(surname("Write-ins")).toBe("Write-ins");
  });
});

describe("the lesson and the little screens", () => {
  it("counts the seeded polls with the engine", () => {
    const { lunch, committee, offsite } = buildLesson();
    expect(lunch.results.winners).toEqual(["Tacos"]);
    expect(lunch.results.pluralityWinner).toBe("Pizza");
    expect(lunch.results.condorcetWinner).toBe("Tacos");
    expect(committee.results.rounds[0]!.transfers[0]!.to).toEqual({ Ben: "1.8000", Cleo: "1.2000" });
    expect(offsite.receipt).toMatch(/^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/);
    expect(offsite.ranking).toEqual(["Lisbon", "Valencia"]);
  });
});

describe("the tabulate example", () => {
  it("sends exactly the request it prints, and prints what the endpoint answers", () => {
    const example = buildApiExample();
    const body = JSON.parse(example.body) as unknown;
    expect(body).toEqual(lunchRequest());
    expect(tabulateInputSchema.safeParse(body).success).toBe(true);
    const response = JSON.parse(example.response) as { winners: string[]; condorcetWinner: string; pluralityWinner: string };
    expect(response).toMatchObject({ winners: ["Tacos"], condorcetWinner: "Tacos", pluralityWinner: "Pizza" });
  });
});

describe("replay labels", () => {
  const off = (expected: string, actual: string) => ({ expected, actual });

  it("says certified only where the count was certified", () => {
    expect(matchLabel("nyc-2025-dem-mayor", [])).toEqual({ tone: "match", text: "Matches the certified count" });
    expect(matchLabel("portland-2024-d1", [])).toEqual({ tone: "match", text: "Matches the certified count" });
    expect(matchLabel("minneapolis-2025-mayor", [])).toEqual({ tone: "match", text: "Matches the city's published round results" });
  });

  it("says how close a replay lands when it does not match", () => {
    expect(matchLabel("burlington-2009-mayor", [off("1000", "999"), off("12", "12")]).text).toBe("Within 1 vote of the official count");
    expect(matchLabel("alaska-2022-special", [off("100", "118"), off("5", "1")]).text).toBe("Within 18 votes of the official count");
  });

  it("turns 'Last, First' into a name", () => {
    expect(personName("Kiss, Bob")).toBe("Bob Kiss");
    expect(personName("Mary S. Peltola")).toBe("Mary S. Peltola");
  });
});

describe("compactJson", () => {
  it("keeps short structures on one line and still parses back", () => {
    const value = { tally: { Pizza: "6", Tacos: "4" }, rounds: [{ round: 1, elected: [] }], nothing: null };
    expect(compactJson(value, 120)).toBe('{ "tally": { "Pizza": "6", "Tacos": "4" }, "rounds": [{ "round": 1, "elected": [] }], "nothing": null }');
    const narrow = compactJson(value, 30);
    expect(narrow.split("\n").length).toBeGreaterThan(1);
    expect(JSON.parse(narrow)).toEqual(value);
  });
});
