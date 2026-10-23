import { createHash } from "node:crypto";
import { presetRules, tabulate } from "@recount/engine";
import { beforeAll, describe, expect, it } from "vitest";
import { createApiToken } from "@/server/apiTokens";
import { electionEndpoint, electionsEndpoint } from "@/server/api/elections";
import { pollCvrEndpoint, pollResultsEndpoint } from "@/server/api/results";
import { tabulateEndpoint } from "@/server/api/tabulate";
import { castBallot } from "@/server/ballots/cast";
import type { Db } from "@/server/db/client";
import { closePoll } from "@/server/polls/close";
import { createPoll } from "@/server/polls/create";
import { serializeRounds } from "@/server/results/serialize";
import { call, postJson, type Handler } from "./apiClient";
import { createTestDb } from "./db";
import { T0, createUser, minutesAfter, pollInput } from "./factories";

const NINE = {
  candidates: ["Alder", "Birch", "Cedar"],
  ballots: [
    { ranking: ["Alder", "Birch"], count: 2 },
    { ranking: ["Alder"], count: 2 },
    { ranking: ["Birch", "Cedar"], count: 3 },
    { ranking: ["Cedar", "Birch"], count: 2 },
  ],
};

describe("API v1 counts", () => {
  let db: Db;
  let now = minutesAfter(10);
  const deps = { db: () => db, now: () => now };
  const tabulateRoute = tabulateEndpoint(deps) as Handler;
  const resultsRoute = pollResultsEndpoint(deps) as Handler;
  const cvrRoute = pollCvrEndpoint(deps) as Handler;
  let owner: string;
  let ownerToken: string;
  let rivalToken: string;

  async function pollWithBallots(overrides = {}) {
    const poll = await createPoll(db, owner, pollInput({ options: NINE.candidates, ...overrides }), T0);
    const idOf = new Map(poll.options.map((o) => [o.label, o.id]));
    let voter = 0;
    for (const { ranking, count } of NINE.ballots) {
      for (let i = 0; i < count; i++) {
        const ids = ranking.map((label) => idOf.get(label)!);
        await castBallot(db, { slug: poll.slug, ranking: ids, voterToken: `v${voter++}` }, minutesAfter(1));
      }
    }
    return poll;
  }

  beforeAll(async () => {
    db = await createTestDb();
    owner = (await createUser(db, "Ada")).id;
    ownerToken = (await createApiToken(db, owner, "tests", T0)).token;
    rivalToken = (await createApiToken(db, (await createUser(db, "Rival")).id, "tests", T0)).token;
  });

  describe("POST /tabulate", () => {
    it("counts the nine-ballot example exactly as the engine does", async () => {
      const response = await call(tabulateRoute, "/tabulate", postJson(NINE));
      expect(response.status).toBe(200);
      const body = await response.json();

      const engine = tabulate({
        candidates: NINE.candidates.map((name) => ({ id: name, name })),
        ballots: NINE.ballots.map(({ ranking, count }) => ({ ranking: ranking.map((n) => [n]), count })),
        rules: presetRules("recount-standard", 1),
      });
      expect(body.rounds).toEqual(serializeRounds(engine));
      expect(body).toMatchObject({ totalBallots: 9, winners: ["Birch"], pluralityWinner: "Alder" });
    });

    it("answers in RCTab's report shape with ?format=rctab", async () => {
      const response = await call(tabulateRoute, "/tabulate?format=rctab", postJson({ ...NINE, contest: "Trees" }));
      const body = await response.json();
      expect(body).toMatchObject({ jsonFormatVersion: "1", config: { contest: "Trees" } });
      expect(body.results).toHaveLength(2);
      expect(body.summary.totalNumBallots).toBe("9");
      expect(body.results[1].tallyResults).toContainEqual(expect.objectContaining({ elected: "Birch" }));
    });

    it("applies a preset and rule overrides", async () => {
      const response = await call(
        tabulateRoute,
        "/tabulate",
        postJson({ ...NINE, presetId: "nyc", rules: { maxRankingsAllowed: 1 } }),
      );
      const body = await response.json();
      expect(body.rules).toMatchObject({ overvoteRule: "exhaustImmediately", maxRankingsAllowed: 1 });
    });

    it.each([
      ["more than 10,000 ballot patterns", { ...NINE, ballots: Array(10_001).fill({ ranking: ["Alder"] }) }],
      ["a ballot naming an unknown candidate", { ...NINE, ballots: [{ ranking: ["Oak"] }] }],
      ["duplicate candidates", { ...NINE, candidates: ["Alder", "Alder"] }],
      ["a reserved candidate name", { ...NINE, candidates: ["exhausted"] }],
    ])("rejects %s", async (_, body) => {
      const response = await call(tabulateRoute, "/tabulate", postJson(body));
      expect(response.status).toBe(422);
    });

    it("rejects a body over 1 MB", async () => {
      const body = { ...NINE, contest: "x".repeat(1_100_000) };
      expect((await call(tabulateRoute, "/tabulate", postJson(body))).status).toBe(413);
    });

    it("limits each address to 30 counts a minute", async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 31; i++) {
        statuses.push((await call(tabulateRoute, "/tabulate", postJson(NINE, { ip: "198.51.100.77" }))).status);
      }
      expect(statuses.slice(0, 30).every((s) => s === 200)).toBe(true);
      expect(statuses[30]).toBe(429);
      expect((await call(tabulateRoute, "/tabulate", postJson(NINE, { ip: "198.51.100.78" }))).status).toBe(200);
    });
  });

  describe("GET /polls/{slug}/results", () => {
    it("returns the live count, or RCTab's shape", async () => {
      const { slug } = await pollWithBallots();
      const response = await call(resultsRoute, `/polls/${slug}/results`);
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toMatchObject({ status: "open", totalBallots: 9, winners: ["Birch"] });

      const rctab = await (await call(resultsRoute, `/polls/${slug}/results?format=rctab`)).json();
      expect(rctab.summary.totalNumBallots).toBe("9");
    });

    it("hides owner_only results behind exactly the response of an unknown slug", async () => {
      const { slug } = await pollWithBallots({ resultsVisibility: "owner_only" });
      const hidden = await call(resultsRoute, `/polls/${slug}/results`);
      const unknown = await call(resultsRoute, "/polls/nosuchpoll/results");
      expect(hidden.status).toBe(404);
      expect(await hidden.text()).toBe(await unknown.text());

      expect((await call(resultsRoute, `/polls/${slug}/results`, { token: rivalToken })).status).toBe(404);
      expect((await call(resultsRoute, `/polls/${slug}/results`, { token: ownerToken })).status).toBe(200);
    });

    it("answers 403 while after_close results are hidden", async () => {
      const { slug } = await pollWithBallots({ resultsVisibility: "after_close" });
      const response = await call(resultsRoute, `/polls/${slug}/results`);
      expect(response.status).toBe(403);
      expect((await response.json()).error.code).toBe("hidden_until_close");
    });

    it("rejects an Authorization header that does not authenticate", async () => {
      const { slug } = await pollWithBallots();
      const response = await call(resultsRoute, `/polls/${slug}/results`, { token: `rk_${"q".repeat(32)}` });
      expect(response.status).toBe(401);
    });
  });

  describe("GET /polls/{slug}/cvr", () => {
    it("waits for the poll to close", async () => {
      const { slug } = await pollWithBallots();
      const response = await call(cvrRoute, `/polls/${slug}/cvr`);
      expect(response.status).toBe(423);
      expect((await response.json()).error).toEqual({
        code: "cvr_not_published",
        message: "The cast-vote record is published when the poll closes",
      });
    });

    it("serves JSON or the exact CSV the published hash covers", async () => {
      const { slug } = await pollWithBallots();
      await closePoll(db, owner, slug, now);
      now = minutesAfter(20);

      const json = await (await call(cvrRoute, `/polls/${slug}/cvr`)).json();
      expect(json.rows).toHaveLength(9);

      const csv = await call(cvrRoute, `/polls/${slug}/cvr?format=csv`);
      expect(csv.headers.get("content-type")).toBe("text/csv; charset=utf-8");
      const text = await csv.text();
      const sha256 = createHash("sha256").update(text).digest("hex");
      expect(sha256).toBe(json.sha256);
      expect(csv.headers.get("x-cvr-sha256")).toBe(sha256);

      const results = await (await call(resultsRoute, `/polls/${slug}/results`)).json();
      expect(results.cvrSha256).toBe(sha256);
    });
  });
});

describe("API v1 elections", () => {
  const listRoute = electionsEndpoint() as Handler;
  const getRoute = electionEndpoint() as Handler;

  it("lists every dataset in the manifest", async () => {
    const response = await call(listRoute, "/elections");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toMatch(/^public/);
    const slugs = (await response.json()).map((e: { slug: string }) => e.slug);
    expect(slugs).toEqual(expect.arrayContaining(["nyc-2025-dem-mayor", "minneapolis-2025-bet", "portland-2024-d1"]));
  });

  it("replays an election and compares it with the official report", async () => {
    const body = await (await call(getRoute, "/elections/minneapolis-2025-bet")).json();
    expect(body.winners.sort()).toEqual(["Eric Harris Bernstein", "Steve Brandt"]);
    expect(body.comparison).toMatchObject({ matches: true, mismatches: [] });
    expect(body.comparison.cells).toBeGreaterThan(0);
  });

  it("reports where a replay differs from the report", async () => {
    const body = await (await call(getRoute, "/elections/burlington-2009-mayor")).json();
    expect(body.comparison.matches).toBe(false);
    expect(body.comparison.mismatches).toHaveLength(2);
  });

  it("answers 404 for an unknown election", async () => {
    expect((await call(getRoute, "/elections/atlantis-1999")).status).toBe(404);
  });
});
