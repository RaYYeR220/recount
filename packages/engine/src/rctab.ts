import { type Fixed, formatFixed } from './fixed';
import type { InactiveKind, TabulationResult } from './result';
import type { CandidateId } from './types';
import { assertCandidateId, record } from './validate';

export interface RctabMetaInput {
  contest: string;
  date?: string;
  jurisdiction?: string;
  office?: string;
}

export interface RctabTallyResult {
  elected?: string;
  eliminated?: string;
  transfers: Record<string, string>;
}

export interface RctabRound {
  inactiveBallots: Record<string, string>;
  round: number;
  tally: Record<string, string>;
  tallyResults: RctabTallyResult[];
  threshold: string;
}

/** The shape of RCTab's `*_detailed_report.json` (jsonFormatVersion 1). */
export interface RctabSummary {
  config: { contest: string; date: string; generatedBy: string; jurisdiction: string; office: string };
  jsonFormatVersion: '1';
  results: RctabRound[];
  summary: {
    finalThreshold: string;
    numCandidates: number;
    numWinners: number;
    totalNumBallots: string;
    undervotes: number;
  };
}

const INACTIVE_KINDS: readonly InactiveKind[] = ['exhaustedChoices', 'overvotes', 'repeatedRankings', 'skippedRankings'];

/** Writes a tabulation in RCTab's detailed report format; numbers print like Java BigDecimal. */
export function toRctabSummary(result: TabulationResult, meta: RctabMetaInput, generatedBy = 'Recount'): RctabSummary {
  const dp = result.rules.decimalPlacesForVoteArithmetic;
  const names = new Map<CandidateId, string>();
  const seen = new Set<string>();
  for (const c of result.candidates) {
    assertCandidateId(c.name);
    if (seen.has(c.name)) throw new TypeError(`two candidates share the name ${JSON.stringify(c.name)}`);
    seen.add(c.name);
    names.set(c.id, c.name);
  }
  const nameOf = (id: CandidateId) => names.get(id) ?? id;
  const num = (v: Fixed, fullScale: boolean) => formatFixed(v, dp, fullScale);

  const results = result.rounds.map((r): RctabRound => {
    const tally = record<string>();
    for (const [id, v] of Object.entries(r.tally)) tally[nameOf(id)] = num(v, r.fractional.tally.includes(id));

    const inactiveBallots = record<string>();
    for (const kind of INACTIVE_KINDS) inactiveBallots[kind] = num(r.inactive[kind], r.fractional.inactive.includes(kind));
    if (r.finalRoundSurplus !== undefined) {
      inactiveBallots.finalRoundSurplus = num(r.finalRoundSurplus, r.fractional.finalRoundSurplus);
    }

    const tallyResults: RctabTallyResult[] = [];
    const entries: Array<['eliminated' | 'elected', CandidateId]> = [
      ...r.eliminated.map((id) => ['eliminated', id] as ['eliminated', CandidateId]),
      ...r.elected.map((id) => ['elected', id] as ['elected', CandidateId]),
    ];
    for (const [kind, id] of entries) {
      const transfer = r.transfers.find((t) => t.from === id);
      const fractional = Object.hasOwn(r.fractional.transfers, id) ? r.fractional.transfers[id]! : [];
      const transfers = record<string>();
      for (const [target, v] of Object.entries(transfer?.to ?? {})) {
        const key = target === 'residualSurplus' ? 'residual surplus' : target === 'exhausted' ? 'exhausted' : nameOf(target);
        transfers[key] = num(v, fractional.includes(target));
      }
      tallyResults.push(kind === 'elected' ? { elected: nameOf(id), transfers } : { eliminated: nameOf(id), transfers });
    }

    return {
      inactiveBallots,
      round: r.round,
      tally,
      tallyResults,
      threshold: num(r.threshold, r.fractional.threshold),
    };
  });

  const last = result.rounds[result.rounds.length - 1];
  return {
    config: {
      contest: meta.contest,
      date: meta.date ?? '',
      generatedBy,
      jurisdiction: meta.jurisdiction ?? '',
      office: meta.office ?? '',
    },
    jsonFormatVersion: '1',
    results,
    summary: {
      finalThreshold: last ? num(last.threshold, last.fractional.threshold) : '0',
      numCandidates: result.candidates.filter((c) => !c.countsOnlyForOvervote).length,
      numWinners: result.rules.numberOfWinners,
      totalNumBallots: String(result.totalBallots),
      undervotes: result.undervotes,
    },
  };
}
