import { describe, expect, it } from "vitest";
import { gateStates, latestVerdicts, parseVerdictComment, pullVerdict, trustedVerdict, type Verdict } from "@/lib/quality/verdict";

/** A comment body in the shape .github/scripts/saboteur-verdict.mjs writes. */
function comment(record: unknown, marker = "saboteur-verdict"): string {
  return [
    "### Saboteur verdict: caught by `ci`",
    "",
    "| Gate | Result |",
    "|---|---|",
    "| [ci](https://github.com/RaYYeR220/recount/actions/runs/1/job/2) | **caught it** at “Engine (unit, property, RCTab conformance, certified replays)” |",
    "",
    `<!-- ${marker} ${typeof record === "string" ? record : JSON.stringify(record)} -->`,
  ].join("\n");
}

const record = {
  mutant: "m08-nyc-no-batch",
  layer: "engine",
  bug: "NYC rules lose batch elimination: same winner, wrong number of rounds.",
  verdict: "killed",
  killedBy: "ci",
  expectedKiller: "ci",
  gates: {
    ci: { state: "failure", step: "Engine (unit, property, RCTab conformance, certified replays)" },
    preflight: null,
    "TestSprite V3": null,
  },
  sha: "0f3c2a1",
  pr: 41,
  at: "2026-10-21T06:40:00.000Z",
};

describe("parseVerdictComment", () => {
  it("reads the record the verdict script leaves in its comment", () => {
    expect(parseVerdictComment(comment(record))).toEqual(record);
  });

  it("accepts a gate without a failed step", () => {
    const passed = { ...record, verdict: "control passed", killedBy: null, gates: { ...record.gates, ci: { state: "success" } } };
    expect(parseVerdictComment(comment(passed))?.gates.ci).toEqual({ state: "success", step: null });
  });

  it("ignores comments without a verdict", () => {
    expect(parseVerdictComment("Looks good to me")).toBeNull();
    expect(parseVerdictComment(comment(record, "something-else"))).toBeNull();
  });

  it("leaves out a malformed verdict instead of showing it wrong", () => {
    expect(parseVerdictComment(comment('{"mutant": "m08-nyc-no-batch", "verdict": '))).toBeNull();
    expect(parseVerdictComment(comment({ ...record, verdict: "probably killed" }))).toBeNull();
    expect(parseVerdictComment(comment({ ...record, mutant: "../../etc" }))).toBeNull();
    expect(parseVerdictComment(comment({ ...record, pr: "41" }))).toBeNull();
    expect(parseVerdictComment(comment({ ...record, at: "yesterday" }))).toBeNull();
    expect(parseVerdictComment(comment({ ...record, killedBy: 3 }))).toBeNull();
    expect(parseVerdictComment(comment({ ...record, gates: { ci: { state: "failure" } } }))).toBeNull();
    expect(parseVerdictComment(comment({ ...record, gates: { ...record.gates, ci: { state: "failure", step: 7 } } }))).toBeNull();
    expect(parseVerdictComment(comment([record]))).toBeNull();
  });
});

describe("trustedVerdict", () => {
  const pr = { number: 41, title: "Saboteur: m08-nyc-no-batch", headRef: "saboteur/m08-nyc-no-batch-18555012345" };
  const catalog = new Set(["m00-noop", "m08-nyc-no-batch", "m10-code-reuse"]);
  const now = new Date("2026-10-22T00:00:00Z");
  const bot = { login: "github-actions[bot]", type: "Bot" };
  const byBot = (r: unknown) => ({ body: comment(r), user: bot });

  it("accepts the workflow bot's verdict on its own pull request", () => {
    expect(trustedVerdict(byBot(record), pr, catalog, now)).toEqual(record);
  });

  it("ignores a forged verdict posted by a person", () => {
    expect(trustedVerdict({ body: comment(record), user: { login: "mallory", type: "User" } }, pr, catalog, now)).toBeNull();
    expect(trustedVerdict({ body: comment(record), user: { login: "github-actions[bot]", type: "User" } }, pr, catalog, now)).toBeNull();
    expect(trustedVerdict({ body: comment(record) }, pr, catalog, now)).toBeNull();
  });

  it("ignores a verdict about another pull request", () => {
    expect(trustedVerdict(byBot({ ...record, pr: 40 }), pr, catalog, now)).toBeNull();
  });

  it("ignores a verdict for a mutant this pull request did not plant, or one not in the catalog", () => {
    expect(trustedVerdict(byBot({ ...record, mutant: "m10-code-reuse" }), pr, catalog, now)).toBeNull();
    const unknown = { number: 41, title: "Saboteur: m99-made-up", headRef: "saboteur/m99-made-up-1" };
    expect(trustedVerdict(byBot({ ...record, mutant: "m99-made-up" }), unknown, catalog, now)).toBeNull();
  });

  it("takes the mutant from the title when the branch name says nothing", () => {
    expect(trustedVerdict(byBot(record), { ...pr, headRef: "some-branch" }, catalog, now)).toEqual(record);
  });

  it("ignores a verdict dated in the future", () => {
    expect(trustedVerdict(byBot({ ...record, at: "2026-10-23T00:00:00.000Z" }), pr, catalog, now)).toBeNull();
  });

  it("keeps the latest trusted verdict when a pull request has several", () => {
    const earlier = { ...record, verdict: "timed out", killedBy: null, at: "2026-10-21T01:00:00.000Z" };
    const forgedLater = { body: comment({ ...record, verdict: "survived", killedBy: null, at: "2026-10-21T23:00:00.000Z" }), user: { login: "mallory", type: "User" } };
    expect(pullVerdict([byBot(earlier), byBot(record), forgedLater], pr, catalog, now)).toEqual(record);
    expect(pullVerdict([forgedLater], pr, catalog, now)).toBeNull();
  });
});

describe("latestVerdicts", () => {
  it("keeps the newest verdict per mutant and counts its runs", () => {
    const older = { ...(record as Verdict), at: "2026-10-20T06:40:00.000Z", verdict: "survived" as const, killedBy: null, pr: 30 };
    const other = { ...(record as Verdict), mutant: "m10-code-reuse", pr: 44 };
    const runs = latestVerdicts([record as Verdict, other, older]);
    expect(runs.get("m08-nyc-no-batch")).toEqual({ latest: record, runs: 2, killed: 1 });
    expect(runs.get("m10-code-reuse")?.runs).toBe(1);
    expect(runs.has("m05-pagination-offset")).toBe(false);
  });
});

describe("gateStates", () => {
  it("takes check runs and statuses alike, the latest per gate, and ignores other checks", () => {
    const gates = gateStates(
      [
        { name: "ci", status: "completed", conclusion: "failure", html_url: "https://example.test/ci/2", completed_at: "2026-10-21T06:30:00Z" },
        { name: "ci", status: "completed", conclusion: "success", html_url: "https://example.test/ci/1", completed_at: "2026-10-20T06:30:00Z" },
        { name: "preflight", status: "in_progress", conclusion: null, started_at: "2026-10-21T06:31:00Z" },
        { name: "Vercel", status: "completed", conclusion: "success" },
      ],
      [
        { context: "TestSprite V3", state: "success", target_url: "https://example.test/ts", updated_at: "2026-10-21T06:50:00Z" },
        { context: "TestSprite V3", state: "pending", updated_at: "2026-10-21T06:35:00Z" },
        { context: "Vercel", state: "success" },
      ],
    );
    expect(gates).toEqual({
      ci: { state: "failure", url: "https://example.test/ci/2", at: "2026-10-21T06:30:00Z" },
      preflight: { state: "pending", url: null, at: "2026-10-21T06:31:00Z" },
      "TestSprite V3": { state: "success", url: "https://example.test/ts", at: "2026-10-21T06:50:00Z" },
    });
  });

  it("reports nothing for a commit no gate has seen", () => {
    expect(gateStates([], [])).toEqual({ ci: null, preflight: null, "TestSprite V3": null });
  });
});
