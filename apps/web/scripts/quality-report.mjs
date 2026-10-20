// Reads the engine's vitest JSON report and the saboteur catalog into the figures
// /quality and the landing print. Pure functions; scripts/quality.mjs does the I/O.

export const FIXTURE_SUITE = "RCTab rules fixtures";
export const REPLAY_SUITE = "certified replays";

const EXACT = /^(\S+) matches the official report in every cell$/;
const DIVERGENT = /^(\S+) differs in exactly (\d+) cells?\b/;
const KNOWN_DIVERGENT = /\(known divergent\b/;

/**
 * @typedef {{ ancestorTitles?: string[]; title?: string; status?: string }} Assertion
 * @typedef {{
 *   engine: { tests: number; passed: number; failed: number };
 *   rctabFixtures: { passed: number; total: number };
 *   replays: { exact: number; total: number; exactSlugs: string[]; divergent: Array<{ slug: string; mismatches: number | null }> };
 * }} QualitySummary
 */

/** @param {unknown} value */
const isCount = (value) => Number.isInteger(value) && /** @type {number} */ (value) >= 0;

/**
 * Engine test count, RCTab fixtures reproduced and certified replays that match
 * the official report in every cell. Throws when the report is not a vitest JSON
 * report or lacks either suite, so a build never prints figures it did not measure.
 * @param {unknown} report
 * @returns {QualitySummary}
 */
export function summarizeReport(report) {
  const r = /** @type {{ numTotalTests?: unknown; numPassedTests?: unknown; numFailedTests?: unknown; testResults?: unknown }} */ (report);
  if (!r || typeof r !== "object" || !Array.isArray(r.testResults)) throw new Error("not a vitest JSON report: testResults is missing");
  if (!isCount(r.numTotalTests) || !isCount(r.numPassedTests) || !isCount(r.numFailedTests)) {
    throw new Error("not a vitest JSON report: test counts are missing");
  }
  /** @type {Assertion[]} */
  const tests = r.testResults.flatMap((file) => (Array.isArray(file?.assertionResults) ? file.assertionResults : []));
  const inSuite = (/** @type {string} */ suite) => tests.filter((t) => t.ancestorTitles?.[0] === suite && typeof t.title === "string");
  const passed = (/** @type {Assertion} */ t) => t.status === "passed";

  const fixtures = inSuite(FIXTURE_SUITE).filter((t) => t.title !== "has fixtures to run");
  if (fixtures.length === 0) throw new Error(`the report has no "${FIXTURE_SUITE}" tests`);
  const reproduced = fixtures.filter((t) => passed(t) && !KNOWN_DIVERGENT.test(t.title ?? "")).length;

  const exactSlugs = [];
  const divergent = [];
  let total = 0;
  for (const t of inSuite(REPLAY_SUITE)) {
    const exact = EXACT.exec(t.title ?? "");
    const off = DIVERGENT.exec(t.title ?? "");
    if (exact) {
      total++;
      if (passed(t)) exactSlugs.push(exact[1]);
    } else if (off) {
      total++;
      divergent.push({ slug: off[1], mismatches: passed(t) ? Number(off[2]) : null });
    }
  }
  if (total === 0) throw new Error(`the report has no "${REPLAY_SUITE}" tests`);

  return {
    engine: { tests: r.numTotalTests, passed: r.numPassedTests, failed: r.numFailedTests },
    rctabFixtures: { passed: reproduced, total: fixtures.length },
    replays: { exact: exactSlugs.length, total, exactSlugs, divergent },
  };
}

/**
 * @typedef {{ date: string; event: string; fix: string }} MutantEvent
 * @typedef {{ id: string; layer: string; bug: string; gates: string[]; expectedKiller: string; caughtBy: string[]; history: MutantEvent[] }} Mutant
 */

/** @param {unknown} v */
const isString = (v) => typeof v === "string" && v.length > 0;
/** @param {unknown} v */
const isStrings = (v) => Array.isArray(v) && v.every((s) => typeof s === "string");

/**
 * One mutants/<id>/meta.json, checked field by field.
 * @param {unknown} meta
 * @param {string} where
 * @returns {Mutant}
 */
export function parseMutant(meta, where) {
  const m = /** @type {Record<string, unknown>} */ (meta);
  if (!m || typeof m !== "object") throw new Error(`${where}: not an object`);
  for (const key of ["id", "layer", "bug", "expectedKiller"]) if (!isString(m[key])) throw new Error(`${where}: ${key} is missing`);
  if (!isStrings(m.gates) || !isStrings(m.caughtBy)) throw new Error(`${where}: gates and caughtBy must be lists of strings`);
  const history = m.history ?? [];
  if (!Array.isArray(history) || !history.every((h) => h && isString(h.date) && isString(h.event) && isString(h.fix))) {
    throw new Error(`${where}: history entries need date, event and fix`);
  }
  return {
    id: /** @type {string} */ (m.id),
    layer: /** @type {string} */ (m.layer),
    bug: /** @type {string} */ (m.bug),
    gates: /** @type {string[]} */ (m.gates),
    expectedKiller: /** @type {string} */ (m.expectedKiller),
    caughtBy: /** @type {string[]} */ (m.caughtBy),
    history: history.map((h) => ({ date: h.date, event: h.event, fix: h.fix })),
  };
}
