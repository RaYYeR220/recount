import type { EssLayout } from './cvr/ess';
import { DEFAULT_RULES, type OvervoteRule, type Rules, type TiebreakMode, type WinnerElectionMode } from './rules';
import type { Candidate } from './types';
import { assertCandidateId } from './validate';

export const UNDECLARED_WRITE_INS = 'Undeclared Write-ins';

export interface RctabSource {
  provider: 'cdf' | 'ess';
  filePath: string;
  contestId?: string;
  ess?: EssLayout;
}

export interface RctabMeta {
  contest: string;
  date?: string;
  jurisdiction?: string;
  office?: string;
}

export interface RctabContest {
  candidates: Candidate[];
  rules: Rules;
  cvrPaths: string[];
  sources: RctabSource[];
  meta: RctabMeta;
}

type Json = Record<string, unknown>;

const TIEBREAKS: readonly TiebreakMode[] = ['useCandidateOrder', 'random', 'previousRoundCountsThenRandom', 'generatePermutation'];
const OVERVOTES: readonly OvervoteRule[] = ['exhaustImmediately', 'alwaysSkipToNextRank', 'exhaustIfMultipleContinuing'];
const MODES: readonly WinnerElectionMode[] = [
  'singleWinnerMajority',
  'multiWinnerAllowOnlyOneWinnerPerRound',
  'multiWinnerAllowMultipleWinnersPerRound',
];

const text = (v: unknown): string => (v === undefined || v === null ? '' : String(v)).trim();
const flag = (v: unknown): boolean => v === true || v === 'true';

function int(v: unknown, field: string): number {
  const n = Number(text(v));
  if (!Number.isInteger(n)) throw new Error(`RCTab config: ${field} must be an integer, got ${JSON.stringify(v)}`);
  return n;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], field: string): T {
  const s = text(v) as T;
  if (!allowed.includes(s)) throw new Error(`RCTab config: unsupported ${field} ${JSON.stringify(v)}`);
  return s;
}

/** Reads an RCTab contest config (see RCTab's config_file_documentation.txt). */
export function loadRctabConfig(json: unknown): RctabContest {
  const config = json as Json;
  const output = (config.outputSettings ?? {}) as Json;
  const r = (config.rules ?? {}) as Json;

  for (const field of ['minimumVoteThreshold', 'stopTabulationEarlyAfterRound']) {
    if (text(r[field]) !== '' && text(r[field]) !== '0') throw new Error(`RCTab config: ${field} is not supported`);
  }

  const declared = ((config.candidates ?? []) as Json[]).map((c): Candidate => {
    const name = text(c.name);
    assertCandidateId(name);
    const aliases = Array.isArray(c.aliases) ? c.aliases.map(text).filter((a) => a !== '') : [];
    return { id: name, name, ...(aliases.length ? { aliases } : {}), ...(flag(c.excluded) ? { excluded: true } : {}) };
  });

  const maxSkipped = text(r.maxSkippedRanksAllowed);
  const maxRankings = text(r.maxRankingsAllowed);
  const rules: Rules = {
    ...DEFAULT_RULES,
    numberOfWinners: int(r.numberOfWinners, 'numberOfWinners'),
    winnerElectionMode: oneOf(r.winnerElectionMode, MODES, 'winnerElectionMode'),
    overvoteRule: oneOf(r.overvoteRule, OVERVOTES, 'overvoteRule'),
    tiebreakMode: oneOf(r.tiebreakMode, TIEBREAKS, 'tiebreakMode'),
    randomSeed: text(r.randomSeed) || '0',
    decimalPlacesForVoteArithmetic: int(r.decimalPlacesForVoteArithmetic, 'decimalPlacesForVoteArithmetic'),
    maxSkippedRanksAllowed: maxSkipped === 'unlimited' ? 'unlimited' : int(maxSkipped, 'maxSkippedRanksAllowed'),
    maxRankingsAllowed: maxRankings === 'max' ? 'max' : int(maxRankings, 'maxRankingsAllowed'),
    nonIntegerWinningThreshold: flag(r.nonIntegerWinningThreshold),
    hareQuota: flag(r.hareQuota),
    batchElimination: flag(r.batchElimination),
    continueUntilTwoCandidatesRemain: flag(r.continueUntilTwoCandidatesRemain),
    exhaustOnDuplicateCandidate: flag(r.exhaustOnDuplicateCandidate),
    firstRoundDeterminesThreshold: flag(r.doesFirstRoundDetermineThreshold),
    eliminateWriteInsFirst: true,
    deferSurplus: false,
  };

  const rawSources = (config.cvrFileSources ?? []) as Json[];
  const hasUwi = rawSources.some((s) => text(s.undeclaredWriteInLabel) !== '');
  // Undeclared write-ins sit outside the declared list, so candidate-order tiebreaks rank
  // them ahead of everyone (never "latest").
  const candidates = hasUwi ? [{ id: UNDECLARED_WRITE_INS, name: UNDECLARED_WRITE_INS, isWriteIn: true }, ...declared] : declared;
  const rankColumns = rules.maxRankingsAllowed === 'max' ? declared.length : rules.maxRankingsAllowed;

  const sources = rawSources.map((s): RctabSource => {
    const provider = oneOf(s.provider, ['cdf', 'ess'] as const, 'provider');
    const filePath = text(s.filePath);
    if (provider === 'cdf') return { provider, filePath, contestId: text(s.contestId) };
    const optional = (v: unknown) => text(v) || undefined;
    const ess: EssLayout = {
      firstVoteColumnIndex: int(s.firstVoteColumnIndex, 'firstVoteColumnIndex'),
      firstVoteRowIndex: int(s.firstVoteRowIndex, 'firstVoteRowIndex'),
      rankColumns,
      overvoteDelimiter: optional(s.overvoteDelimiter),
      overvoteLabel: optional(s.overvoteLabel),
      skippedRankLabel: optional(s.skippedRankLabel ?? s.undervoteLabel),
      undeclaredWriteInLabel: optional(s.undeclaredWriteInLabel),
      undeclaredWriteInId: hasUwi ? UNDECLARED_WRITE_INS : undefined,
      treatBlankAsUndeclaredWriteIn: flag(s.treatBlankAsUndeclaredWriteIn) || flag(r.treatBlankAsUndeclaredWriteIn),
    };
    return { provider, filePath, ess };
  });

  return {
    candidates,
    rules,
    cvrPaths: sources.map((s) => s.filePath),
    sources,
    meta: {
      contest: text(output.contestName),
      date: text(output.contestDate),
      jurisdiction: text(output.contestJurisdiction),
      office: text(output.contestOffice),
    },
  };
}
