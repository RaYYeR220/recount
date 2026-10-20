/** Figures from the engine's test run, written by scripts/quality.mjs before each build. */
export type QualityReport = {
  /** When the suite ran (ISO 8601). */
  ranAt: string;
  engine: { tests: number; passed: number; failed: number };
  /** RCTab's own rules fixtures the engine reproduces exactly. */
  rctabFixtures: { passed: number; total: number };
  /** Official reports replayed from their ballots; `exact` match in every cell. */
  replays: {
    exact: number;
    total: number;
    exactSlugs: string[];
    /** Known differences, with the mismatch count the suite pins (null when that test failed). */
    divergent: Array<{ slug: string; mismatches: number | null }>;
  };
};

export type MutantEvent = { date: string; event: string; fix: string };

/** One planted bug from mutants/<id>/meta.json. */
export type Mutant = {
  id: string;
  layer: string;
  bug: string;
  /** Gates the mutant meets: ci, preflight, TestSprite V3. */
  gates: string[];
  expectedKiller: string;
  /** Tests that fail on it, "ci: suite > test". */
  caughtBy: string[];
  /** Times it got through, and the test added afterwards. */
  history: MutantEvent[];
};

export type MutantCatalog = { mutants: Mutant[] };
