// src/build-data/ is written by scripts/quality.mjs before dev and build and is not
// in git, so typecheck and lint can run on a fresh checkout. The bundler still needs
// the real files: a build without them fails at the import.
declare module "@/build-data/quality.json" {
  const report: import("./types").QualityReport;
  export default report;
}

declare module "@/build-data/mutants.json" {
  const catalog: import("./types").MutantCatalog;
  export default catalog;
}
