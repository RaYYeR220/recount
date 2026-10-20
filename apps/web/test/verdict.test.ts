import { describe, expect, it } from "vitest";
import { gateStates, latestVerdicts, parseVerdictComment, type Verdict } from "@/lib/quality/verdict";

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
