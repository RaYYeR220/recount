export * from './fixed';
export * from './types';
export * from './rules';
export * from './result';
export { resolveChoice } from './choice';
export { computeThreshold, type Threshold } from './threshold';
export { createTiebreaker, type Tiebreaker } from './tiebreak';
export { JavaRandom, javaShuffle } from './javaRandom';
export { tabulate } from './tabulate';
export { assertCandidateId } from './validate';
export { toRctabSummary, type RctabSummary, type RctabRound, type RctabTallyResult, type RctabMetaInput } from './rctab';
export {
  loadRctabConfig,
  UNDECLARED_WRITE_INS,
  type RctabContest,
  type RctabMeta,
  type RctabSource,
} from './rctabConfig';
export { parseCdfCvr, type CdfOptions } from './cvr/cdf';
export { parseEssRows, type EssLayout } from './cvr/ess';
export { parseSharedStrings, parseSheet, SheetRowReader, type SheetRow } from './cvr/xlsx';
export { PatternCounter } from './cvr/names';
export { PRESETS, presetRules, type PresetId } from './presets';
export type { DatasetSource, ElectionDataset, Golden, GoldenRound, ReportConvention } from './dataset';
export { compareToGolden, type GoldenComparison, type GoldenMismatch } from './golden';
export { pairwise, pluralityWinner, type PairwiseResult } from './pairwise';
