import catalog from "@/build-data/mutants.json";
import report from "@/build-data/quality.json";
import type { Mutant, QualityReport } from "./types";

export type { Mutant, MutantEvent, QualityReport } from "./types";

/** Engine test figures measured when this deployment was built. */
export const quality: QualityReport = report;

/** The saboteur's planted bugs, in id order. */
export const mutants: Mutant[] = catalog.mutants;
