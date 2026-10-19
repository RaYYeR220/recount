export type CandidateId = string;

export interface Candidate {
  id: CandidateId;
  name: string;
  /** Ignored for the whole count, as if eliminated before round 1. */
  excluded?: boolean;
  /** Undeclared write-ins; eliminated first when the rules ask for it. */
  isWriteIn?: boolean;
  /** A mark that can make a rank an overvote but is never a vote (e.g. blank write-in lines). */
  countsOnlyForOvervote?: boolean;
}

/** Candidates marked at one rank: [] is a skipped rank, more than one is an overvote. */
export type Slot = readonly CandidateId[];

export interface BallotPattern {
  ranking: readonly Slot[];
  /** Number of identical ballots, a positive integer. */
  count: number;
}

export type InactiveReason = 'overvote' | 'skippedRankings' | 'repeatedRankings' | 'exhaustedChoices';

export type Resolution =
  | { kind: 'vote'; candidate: CandidateId }
  | { kind: 'inactive'; reason: InactiveReason }
  | { kind: 'undervote' };
