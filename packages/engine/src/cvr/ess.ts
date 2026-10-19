import type { BallotPattern, Candidate, CandidateId, Slot } from '../types';
import { UNKNOWN_OVERVOTE } from '../types';
import { nameIndex, PatternCounter } from './names';
import type { SheetRow } from './xlsx';

/** Column layout and labels of an ES&S-style spreadsheet CVR (RCTab cvrFileSources fields). */
export interface EssLayout {
  /** 1-based column of the first ranking. */
  firstVoteColumnIndex: number;
  /** 1-based row of the first ballot. */
  firstVoteRowIndex: number;
  /** How many ranking columns to read. */
  rankColumns: number;
  overvoteDelimiter?: string;
  overvoteLabel?: string;
  skippedRankLabel?: string;
  undeclaredWriteInLabel?: string;
  /** Id of the candidate that undeclared write-in cells count for. */
  undeclaredWriteInId?: CandidateId;
  treatBlankAsUndeclaredWriteIn?: boolean;
}

/** Turns spreadsheet rows (one ballot per row, one rank per column) into ballot patterns. */
export function parseEssRows(rows: Iterable<SheetRow>, layout: EssLayout, candidates: readonly Candidate[]): BallotPattern[] {
  const names = nameIndex(candidates);
  const counter = new PatternCounter();
  const skipLabel = layout.skippedRankLabel || 'undervote';
  const overLabel = layout.overvoteLabel || 'overvote';
  const first = layout.firstVoteColumnIndex - 1;

  const lookup = (raw: string): CandidateId => {
    if (layout.undeclaredWriteInLabel && raw === layout.undeclaredWriteInLabel && layout.undeclaredWriteInId) {
      return layout.undeclaredWriteInId;
    }
    const id = names.get(raw);
    if (id === undefined) throw new Error(`unrecognized candidate in CVR: ${JSON.stringify(raw)}`);
    return id;
  };

  // When skipped ranks carry their own label, an unlabelled blank cell is a write-in the
  // scanner could not resolve (RCTab's 2015 Portland ME fixture counts it that way).
  const blankIsWriteIn =
    layout.undeclaredWriteInId !== undefined &&
    (layout.treatBlankAsUndeclaredWriteIn === true || (layout.undeclaredWriteInLabel !== undefined && layout.skippedRankLabel !== undefined));

  const slotOf = (cell: string | null | undefined): Slot => {
    const raw = (cell ?? '').trim();
    if (raw === '') return blankIsWriteIn ? [layout.undeclaredWriteInId!] : [];
    if (raw === skipLabel) return [];
    if (raw === overLabel) return UNKNOWN_OVERVOTE;
    if (layout.overvoteDelimiter && raw.includes(layout.overvoteDelimiter)) {
      return [...new Set(raw.split(layout.overvoteDelimiter).map((s) => lookup(s.trim())))];
    }
    return [lookup(raw)];
  };

  for (const row of rows) {
    if (row.index < layout.firstVoteRowIndex) continue;
    const cells = Array.from({ length: layout.rankColumns }, (_, i) => row.cells[first + i]);
    // A row with nothing in this contest's columns is a ballot for some other contest.
    if (cells.every((c) => c === null || c === undefined || c.trim() === '')) continue;
    counter.add(cells.map(slotOf));
  }
  return counter.patterns();
}
