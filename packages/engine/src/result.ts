import type { Fixed } from './fixed';
import type { Rules } from './rules';
import type { BallotPattern, Candidate, CandidateId } from './types';

export interface InactiveCounts {
  overvotes: Fixed;
  skippedRankings: Fixed;
  repeatedRankings: Fixed;
  exhaustedChoices: Fixed;
}

export type InactiveKind = keyof InactiveCounts;

/** Candidate ids plus the two non-candidate destinations of a transfer. */
export type TransferTarget = CandidateId | 'exhausted' | 'residualSurplus';

export interface Transfer {
  from: CandidateId;
  to: Record<TransferTarget, Fixed>;
}

/**
 * Totals that include ballots carried at a fractional transfer value. RCTab prints
 * those at full scale even when whole ("8.0000"), so the summary needs to know.
 */
export interface FractionalMarks {
  threshold: boolean;
  tally: CandidateId[];
  inactive: InactiveKind[];
  transfers: Record<CandidateId, TransferTarget[]>;
  finalRoundSurplus: boolean;
}

export interface RoundResult {
  round: number;
  /** Continuing candidates, plus elected candidates holding their votes in multi-seat counts. */
  tally: Record<CandidateId, Fixed>;
  activeTotal: Fixed;
  threshold: Fixed;
  /** Decided at the end of this round. */
  elected: CandidateId[];
  eliminated: CandidateId[];
  /** Votes leaving elected or eliminated candidates at the end of this round. */
  transfers: Transfer[];
  /** Cumulative inactive ballots by reason. */
  inactive: InactiveCounts;
  /** Cumulative votes lost to truncation when surpluses moved. */
  residualSurplus: Fixed;
  /** Final round of a multi-seat count: surplus that had nowhere left to go. */
  finalRoundSurplus?: Fixed;
  fractional: FractionalMarks;
}

export interface TabulationResult {
  rounds: RoundResult[];
  winners: CandidateId[];
  totalBallots: number;
  undervotes: number;
  rules: Rules;
  candidates: Candidate[];
}

export interface TabulationInput {
  candidates: Candidate[];
  ballots: BallotPattern[];
  rules: Rules;
}
