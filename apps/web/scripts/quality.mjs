// Runs the engine's test suite before `next build` and writes the figures /quality
// and the landing print: engine tests, RCTab rules fixtures reproduced, certified
// replays that match exactly (src/build-data/quality.json), plus the saboteur
// catalog from mutants/*/meta.json (src/build-data/mutants.json). Exits non-zero
// when the suite cannot run or its report lacks what the pages need, so a build
// never ships figures nobody measured.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMutant, summarizeReport } from "./quality-report.mjs";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const engine = join(web, "..", "..", "packages", "engine");
const mutants = join(web, "..", "..", "mutants");
const out = join(web, "src", "build-data");

function fail(message) {
  console.error(`\nquality: ${message}\n`);
  process.exit(1);
}

function runEngineSuite() {
  const vitest = join(dirname(createRequire(join(engine, "package.json")).resolve("vitest/package.json")), "vitest.mjs");
  const dir = mkdtempSync(join(tmpdir(), "recount-quality-"));
  const file = join(dir, "engine.json");
  try {
    const run = spawnSync(process.execPath, [vitest, "run", "--reporter=json", `--outputFile=${file}`], {
      cwd: engine,
      stdio: ["ignore", "ignore", "inherit"],
    });
    if (run.error) fail(`could not start the engine tests: ${run.error.message}`);
    if (!existsSync(file)) fail(`the engine tests wrote no report (exit code ${run.status})`);
    return JSON.parse(readFileSync(file, "utf8"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function readCatalog() {
  const ids = readdirSync(mutants, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(mutants, d.name, "meta.json")))
    .map((d) => d.name)
    .sort();
  if (ids.length === 0) fail("mutants/ has no meta.json files");
  return ids.map((id) => {
    const where = `mutants/${id}/meta.json`;
    const mutant = parseMutant(JSON.parse(readFileSync(join(mutants, id, "meta.json"), "utf8")), where);
    if (mutant.id !== id) fail(`${where}: id ${mutant.id} does not match its directory`);
    return mutant;
  });
}

let summary;
let catalog;
try {
  summary = summarizeReport(runEngineSuite());
  catalog = readCatalog();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

mkdirSync(out, { recursive: true });
const ranAt = new Date().toISOString();
writeFileSync(join(out, "quality.json"), `${JSON.stringify({ ranAt, ...summary }, null, 2)}\n`);
writeFileSync(join(out, "mutants.json"), `${JSON.stringify({ mutants: catalog }, null, 2)}\n`);

const { engine: e, rctabFixtures: f, replays: r } = summary;
console.log(
  `quality: ${e.tests} engine tests (${e.failed} failing), ${f.passed} of ${f.total} RCTab rules fixtures, ` +
    `${r.exact} of ${r.total} elections exact, ${catalog.length} mutants`,
);
if (e.failed > 0) console.warn("quality: engine tests are failing; the pages will print these figures as they are");
