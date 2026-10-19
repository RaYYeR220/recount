import type { BallotPattern, Candidate, CandidateId, Slot } from '../types';
import { nameIndex, PatternCounter } from './names';

type Json = Record<string, unknown>;

const asArray = (v: unknown): Json[] => (Array.isArray(v) ? (v as Json[]) : []);
const asString = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

export interface CdfOptions {
  /** Contest @id or Name; may be omitted when the report has a single contest. */
  contestId?: string;
}

/** NIST SP 1500-103 cast vote record report (JSON) to ballot patterns for one contest. */
export function parseCdfCvr(json: unknown, candidates: readonly Candidate[], options: CdfOptions = {}): BallotPattern[] {
  const report = json as Json;
  const elections = asArray(report.Election);
  const contests = elections.flatMap((e) => asArray(e.Contest));
  const contest =
    options.contestId === undefined
      ? contests.length === 1
        ? contests[0]
        : undefined
      : contests.find((c) => c['@id'] === options.contestId || c.Name === options.contestId);
  if (!contest) throw new Error(`contest ${JSON.stringify(options.contestId)} not found in CDF report`);
  const contestKey = asString(contest['@id']);

  const names = nameIndex(candidates);
  const cdfCandidateName = new Map<string, string>();
  for (const e of elections) {
    for (const c of asArray(e.Candidate)) {
      const id = asString(c['@id']);
      const name = asString(c.Name);
      if (id !== undefined && name !== undefined) cdfCandidateName.set(id, name);
    }
  }
  const selectionToCandidate = new Map<string, CandidateId>();
  for (const sel of asArray(contest.ContestSelection)) {
    const selId = asString(sel['@id']);
    const cdfCandidate = asString((sel.CandidateIds as unknown[] | undefined)?.[0]);
    if (selId === undefined || cdfCandidate === undefined) continue;
    const name = cdfCandidateName.get(cdfCandidate) ?? cdfCandidate;
    const id = names.get(name);
    if (id === undefined) throw new Error(`unrecognized candidate in CVR: ${JSON.stringify(name)}`);
    selectionToCandidate.set(selId, id);
  }

  const counter = new PatternCounter();
  for (const cvr of asArray(report.CVR)) {
    const snapshots = asArray(cvr.CVRSnapshot);
    const current = snapshots.find((s) => s['@id'] === cvr.CurrentSnapshotId) ?? snapshots[0];
    const voted = asArray(current?.CVRContest).find((c) => c.ContestId === contestKey);
    if (!voted) continue;
    const ranks = new Map<number, Set<CandidateId>>();
    for (const sel of asArray(voted.CVRContestSelection)) {
      const id = selectionToCandidate.get(asString(sel.ContestSelectionId) ?? '');
      if (id === undefined) throw new Error(`unknown contest selection ${JSON.stringify(sel.ContestSelectionId)}`);
      for (const pos of asArray(sel.SelectionPosition)) {
        if (pos.HasIndication === 'no' || pos.IsAllocable === 'no') continue;
        const rank = Number(pos.Rank);
        if (!Number.isInteger(rank) || rank < 1) continue;
        const set = ranks.get(rank) ?? new Set<CandidateId>();
        set.add(id);
        ranks.set(rank, set);
      }
    }
    const depth = Math.max(0, ...ranks.keys());
    const ranking: Slot[] = Array.from({ length: depth }, (_, i) => [...(ranks.get(i + 1) ?? [])]);
    counter.add(ranking);
  }
  return counter.patterns();
}
