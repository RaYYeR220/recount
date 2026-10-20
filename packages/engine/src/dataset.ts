import type { PresetId } from './presets';
import type { BallotPattern, Candidate } from './types';

/** How the official report counts inactive ballots, so comparisons line up. */
export interface ReportConvention {
  /**
   * `cumulative`: every inactive ballot since round 1.
   * `afterFirstRound`: ballots already inactive in round 1 (blank, overvoted, or with only
   * write-in marks) are reported elsewhere, e.g. as undervotes, and left out.
   */
  inactive: 'cumulative' | 'afterFirstRound';
  notes?: string;
}

export interface DatasetSource {
  url: string;
  sha256: string;
  file: string;
  retrievedAt: string;
  publisher: string;
  license: string;
  contest?: string;
}

/** A published election replay: ballots as weighted patterns plus where they came from. */
export interface ElectionDataset {
  slug: string;
  title: string;
  jurisdiction: string;
  date: string;
  office: string;
  seats: number;
  presetId: PresetId;
  candidates: Candidate[];
  ballots: BallotPattern[];
  source: DatasetSource;
  reportConvention: ReportConvention;
}

export interface GoldenRound {
  round: number;
  /** Votes by candidate name, as printed in the report. */
  tally: Record<string, string>;
  /** Inactive ballots as the report labels them (NYC "Inactive ballots"). */
  inactive?: string;
  /** Same quantity where the report calls it "Exhausted" (Minneapolis, Burlington). */
  exhausted?: string;
}

/** Round-by-round results transcribed from an official report. */
export interface Golden {
  slug: string;
  sourceUrl: string;
  /** SHA-256 of the report file the numbers were read from; null if it could not be fetched. */
  reportSha256: string | null;
  retrievedAt: string;
  /** Set when the numbers were taken from a transcription rather than the report itself. */
  transcribedFrom?: { url: string; sha256: string };
  reportParts?: Array<{ url: string; sha256: string }>;
  notes?: string;
  rounds: GoldenRound[];
  winners: string[];
}
