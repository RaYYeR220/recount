export type WinnerElectionMode =
  | 'singleWinnerMajority'
  | 'multiWinnerAllowOnlyOneWinnerPerRound'
  | 'multiWinnerAllowMultipleWinnersPerRound';

export type OvervoteRule = 'exhaustImmediately' | 'alwaysSkipToNextRank' | 'exhaustIfMultipleContinuing';

export type TiebreakMode = 'useCandidateOrder' | 'random' | 'previousRoundCountsThenRandom' | 'generatePermutation';

/** Tabulation options. Names and meanings follow RCTab's contest config. */
export interface Rules {
  numberOfWinners: number;
  winnerElectionMode: WinnerElectionMode;
  overvoteRule: OvervoteRule;
  maxSkippedRanksAllowed: number | 'unlimited';
  maxRankingsAllowed: number | 'max';
  exhaustOnDuplicateCandidate: boolean;
  batchElimination: boolean;
  continueUntilTwoCandidatesRemain: boolean;
  tiebreakMode: TiebreakMode;
  /** Decimal string of a Java long, used to seed java.util.Random. */
  randomSeed?: string;
  decimalPlacesForVoteArithmetic: number;
  nonIntegerWinningThreshold: boolean;
  hareQuota: boolean;
  firstRoundDeterminesThreshold: boolean;
  /** Minneapolis STV: defeat hopeless candidates before moving a surplus that cannot save them. */
  deferSurplus: boolean;
  eliminateWriteInsFirst: boolean;
}

export const DEFAULT_RULES: Rules = {
  numberOfWinners: 1,
  winnerElectionMode: 'singleWinnerMajority',
  overvoteRule: 'alwaysSkipToNextRank',
  maxSkippedRanksAllowed: 'unlimited',
  maxRankingsAllowed: 'max',
  exhaustOnDuplicateCandidate: false,
  batchElimination: false,
  continueUntilTwoCandidatesRemain: false,
  tiebreakMode: 'previousRoundCountsThenRandom',
  randomSeed: '0',
  decimalPlacesForVoteArithmetic: 4,
  nonIntegerWinningThreshold: false,
  hareQuota: false,
  firstRoundDeterminesThreshold: false,
  deferSurplus: false,
  eliminateWriteInsFirst: false,
};

export function isMultiWinner(rules: Rules): boolean {
  return rules.winnerElectionMode !== 'singleWinnerMajority';
}
