import { DEFAULT_RULES, type Rules } from './rules';

export type PresetId =
  | 'recount-standard'
  | 'nyc'
  | 'minneapolis-irv'
  | 'minneapolis-stv'
  | 'portland-stv'
  | 'alaska'
  | 'burlington-2009';

/** Rule profiles that reproduce each jurisdiction's published counts. Seats come from the contest. */
export const PRESETS: Record<PresetId, Partial<Rules>> = {
  'recount-standard': {
    tiebreakMode: 'previousRoundCountsThenRandom',
  },
  // NYC Board of Elections: an overvote exhausts, write-ins go first, batch elimination,
  // count down to the final two.
  nyc: {
    overvoteRule: 'exhaustImmediately',
    maxSkippedRanksAllowed: 'unlimited',
    maxRankingsAllowed: 5,
    eliminateWriteInsFirst: true,
    batchElimination: true,
    continueUntilTwoCandidatesRemain: true,
  },
  // Minneapolis Code ch. 167: an overvoted rank is skipped, three rankings, threshold fixed
  // after round 1, simultaneous defeat of candidates who cannot win.
  'minneapolis-irv': {
    overvoteRule: 'alwaysSkipToNextRank',
    maxRankingsAllowed: 3,
    maxSkippedRanksAllowed: 'unlimited',
    batchElimination: true,
    firstRoundDeterminesThreshold: true,
  },
  'minneapolis-stv': {
    winnerElectionMode: 'multiWinnerAllowMultipleWinnersPerRound',
    overvoteRule: 'alwaysSkipToNextRank',
    maxRankingsAllowed: 3,
    maxSkippedRanksAllowed: 'unlimited',
    decimalPlacesForVoteArithmetic: 4,
    deferSurplus: true,
  },
  // Multnomah County runs RCTab: an overvoted rank is skipped, six rankings, undeclared
  // write-ins eliminated first, fractional surplus at four decimals.
  'portland-stv': {
    winnerElectionMode: 'multiWinnerAllowMultipleWinnersPerRound',
    overvoteRule: 'alwaysSkipToNextRank',
    maxRankingsAllowed: 6,
    maxSkippedRanksAllowed: 'unlimited',
    decimalPlacesForVoteArithmetic: 4,
    eliminateWriteInsFirst: true,
  },
  // Alaska Stat. 15.15.350: an overvote makes the ballot inactive, two consecutive skipped
  // rankings exhaust it, repeated rankings are passed over.
  alaska: {
    overvoteRule: 'exhaustImmediately',
    maxSkippedRanksAllowed: 1,
    maxRankingsAllowed: 4,
    exhaustOnDuplicateCandidate: false,
    eliminateWriteInsFirst: true,
    batchElimination: true,
  },
  // Burlington 2009 (ChoicePlus Pro): Droop majority, simultaneous drop when inevitable.
  'burlington-2009': {
    overvoteRule: 'exhaustImmediately',
    maxSkippedRanksAllowed: 'unlimited',
    maxRankingsAllowed: 5,
    batchElimination: true,
  },
};

export function presetRules(id: PresetId, seats = 1): Rules {
  const preset = PRESETS[id];
  if (!preset) throw new Error(`unknown preset ${JSON.stringify(id)}`);
  const rules: Rules = { ...DEFAULT_RULES, ...preset, numberOfWinners: seats };
  if (seats > 1 && rules.winnerElectionMode === 'singleWinnerMajority') {
    rules.winnerElectionMode = 'multiWinnerAllowMultipleWinnersPerRound';
  }
  return rules;
}
