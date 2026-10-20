import { describe, expect, it } from "vitest";
import { parseMutant, summarizeReport } from "../scripts/quality-report.mjs";

type Assertion = { ancestorTitles: string[]; title: string; status: string };

const fixture = (title: string, status = "passed"): Assertion => ({ ancestorTitles: ["RCTab rules fixtures"], title, status });
const replay = (title: string, status = "passed"): Assertion => ({ ancestorTitles: ["certified replays"], title, status });

function report(tests: Assertion[], extra: Record<string, unknown> = {}) {
  const failed = tests.filter((t) => t.status === "failed").length;
  return {
    numTotalTests: tests.length,
    numPassedTests: tests.length - failed,
    numFailedTests: failed,
    success: failed === 0,
    testResults: [{ name: "a.test.ts", assertionResults: tests.slice(0, 3) }, { name: "b.test.ts", assertionResults: tests.slice(3) }],
    ...extra,
  };
}

const healthy = [
  fixture("has fixtures to run"),
  fixture("2013_minneapolis_park"),
  fixture("2015_portland_mayor"),
  fixture("tiebreak_seed_test"),
  replay("nyc-2025-dem-mayor matches the official report in every cell"),
  replay("portland-2024-d1 matches the official report in every cell"),
  replay("burlington-2009-mayor differs in exactly 2 cells (FairVote's normalised ballots, not the city's file)"),
  replay("the NYC 2025 replay has the certified ballot count"),
  { ancestorTitles: ["STV"], title: "surplus transfers at truncated fraction", status: "passed" },
];

describe("summarizeReport", () => {
  it("counts engine tests, reproduced fixtures and exact replays", () => {
    expect(summarizeReport(report(healthy))).toEqual({
      engine: { tests: 9, passed: 9, failed: 0 },
      rctabFixtures: { passed: 3, total: 3 },
      replays: {
        exact: 2,
        total: 3,
        exactSlugs: ["nyc-2025-dem-mayor", "portland-2024-d1"],
        divergent: [{ slug: "burlington-2009-mayor", mismatches: 2 }],
      },
    });
  });

  it("prints a failing suite as it is: a failed fixture or replay is not counted as reproduced", () => {
    const tests = healthy.map((t) =>
      t.title === "2015_portland_mayor" || t.title.startsWith("portland-2024-d1") ? { ...t, status: "failed" } : t,
    );
    const summary = summarizeReport(report(tests));
    expect(summary.engine).toEqual({ tests: 9, passed: 7, failed: 2 });
    expect(summary.rctabFixtures).toEqual({ passed: 2, total: 3 });
    expect(summary.replays.exact).toBe(1);
    expect(summary.replays.total).toBe(3);
  });

  it("does not count a fixture kept as known divergent", () => {
    const tests = [...healthy, fixture("continue_tabulation_test (known divergent: needs per-round output)")];
    expect(summarizeReport(report(tests)).rctabFixtures).toEqual({ passed: 3, total: 4 });
  });

  it("leaves the mismatch count unknown when a divergence test fails", () => {
    const tests = healthy.map((t) => (t.title.startsWith("burlington") ? { ...t, status: "failed" } : t));
    expect(summarizeReport(report(tests)).replays.divergent).toEqual([{ slug: "burlington-2009-mayor", mismatches: null }]);
  });

  it("refuses anything that is not a vitest JSON report", () => {
    expect(() => summarizeReport(null)).toThrow("not a vitest JSON report");
    expect(() => summarizeReport({ testResults: [] })).toThrow("test counts are missing");
    expect(() => summarizeReport({ numTotalTests: "9", numPassedTests: 9, numFailedTests: 0, testResults: [] })).toThrow("test counts");
  });

  it("refuses a report without the fixtures or the replays rather than printing zeros", () => {
    const noFixtures = healthy.filter((t) => t.ancestorTitles[0] !== "RCTab rules fixtures");
    expect(() => summarizeReport(report(noFixtures))).toThrow('no "RCTab rules fixtures" tests');
    const noReplays = healthy.filter((t) => t.ancestorTitles[0] !== "certified replays");
    expect(() => summarizeReport(report(noReplays))).toThrow('no "certified replays" tests');
  });
});

describe("parseMutant", () => {
  const meta = {
    id: "m06-cvr-row-order",
    layer: "service",
    bug: "CVR rows are ordered by cast time instead of receipt.",
    gates: ["ci"],
    expectedKiller: "ci",
    caughtBy: ["ci: results > CVR > orders rows by receipt"],
    history: [{ date: "2026-10-20", event: "Survived: every test passed.", fix: "a24402d test(web): CVR rows follow receipt order" }],
  };

  it("keeps every field and defaults history to none", () => {
    expect(parseMutant(meta, "m06")).toEqual(meta);
    const { history: _, ...noHistory } = meta;
    expect(parseMutant(noHistory, "m06").history).toEqual([]);
  });

  it("names the file and the field when the catalog is malformed", () => {
    expect(() => parseMutant({ ...meta, bug: "" }, "mutants/m06/meta.json")).toThrow("mutants/m06/meta.json: bug is missing");
    expect(() => parseMutant({ ...meta, caughtBy: "ci" }, "m06")).toThrow("gates and caughtBy must be lists");
    expect(() => parseMutant({ ...meta, history: [{ date: "2026-10-20" }] }, "m06")).toThrow("history entries need date, event and fix");
    expect(() => parseMutant("m06", "m06")).toThrow("not an object");
  });
});
