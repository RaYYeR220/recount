import { resolveChoice } from './choice';
import { type Fixed, mulTrunc } from './fixed';
import type { InactiveKind, TransferTarget } from './result';
import type { Rules } from './rules';
import type { BallotPattern, Candidate, CandidateId, InactiveReason, Slot } from './types';

/** An amount plus whether any part of it was carried at a fractional transfer value. */
export interface Valued {
  value: Fixed;
  fractional: boolean;
}

type Bucket = InactiveKind | 'finalRoundSurplus' | 'undervote';

interface Group {
  ranking: readonly Slot[];
  count: bigint;
  /** Value of one ballot in the group, in fixed-point units. */
  weight: Fixed;
  fractional: boolean;
  at: CandidateId | null;
  bucket: Bucket | null;
}

export interface Snapshot {
  tally: Map<CandidateId, Valued>;
  inactive: Record<InactiveKind, Valued>;
  finalRoundSurplus: Valued;
}

export type Movement = Map<TransferTarget, Valued>;

const INACTIVE_KIND: Record<InactiveReason, InactiveKind> = {
  overvote: 'overvotes',
  skippedRankings: 'skippedRankings',
  repeatedRankings: 'repeatedRankings',
  exhaustedChoices: 'exhaustedChoices',
};

export function addValued(map: Map<string, Valued>, key: string, value: Fixed, fractional: boolean): void {
  const cur = map.get(key);
  if (cur) {
    cur.value += value;
    cur.fractional ||= fractional;
  } else {
    map.set(key, { value, fractional });
  }
}

/** Ballot groups and where each one currently counts. */
export class BallotPool {
  readonly totalBallots: bigint;
  readonly undervotes: bigint;
  private readonly groups: Group[];
  private readonly byCandidate = new Map<CandidateId, Group[]>();

  constructor(
    ballots: readonly BallotPattern[],
    private readonly candidates: ReadonlyMap<CandidateId, Candidate>,
    private readonly rules: Rules,
    continuing: ReadonlySet<CandidateId>,
    one: Fixed,
  ) {
    this.groups = ballots.map((b) => {
      const group: Group = { ranking: b.ranking, count: BigInt(b.count), weight: one, fractional: false, at: null, bucket: null };
      this.place(group, continuing, false);
      return group;
    });
    this.totalBallots = this.groups.reduce((s, g) => s + g.count, 0n);
    this.undervotes = this.groups.reduce((s, g) => (g.bucket === 'undervote' ? s + g.count : s), 0n);
  }

  snapshot(): Snapshot {
    const tally = new Map<CandidateId, Valued>();
    const inactive = new Map<string, Valued>();
    for (const g of this.groups) {
      const value = g.count * g.weight;
      if (g.at !== null) addValued(tally, g.at, value, g.fractional);
      else if (g.bucket !== 'undervote') addValued(inactive, g.bucket!, value, g.fractional);
    }
    const get = (k: string): Valued => inactive.get(k) ?? { value: 0n, fractional: false };
    return {
      tally,
      inactive: {
        overvotes: get('overvotes'),
        skippedRankings: get('skippedRankings'),
        repeatedRankings: get('repeatedRankings'),
        exhaustedChoices: get('exhaustedChoices'),
      },
      finalRoundSurplus: get('finalRoundSurplus'),
    };
  }

  /** Moves every ballot sitting with one of `from` to its next continuing choice. */
  move(from: ReadonlySet<CandidateId>, continuing: ReadonlySet<CandidateId>): Map<CandidateId, Movement> {
    const out = new Map<CandidateId, Movement>();
    for (const source of from) {
      const movement: Movement = new Map();
      for (const g of this.take(source)) {
        this.place(g, continuing, false);
        this.record(movement, g, g.count * g.weight);
      }
      out.set(source, movement);
    }
    return out;
  }

  /**
   * Sends `fraction` of each ballot held by an elected candidate onward. Returns what moved
   * and what stayed behind. With `final`, ballots with nowhere to go are booked as final
   * round surplus instead of as inactive.
   */
  moveSurplus(
    from: CandidateId,
    fraction: Fixed,
    continuing: ReadonlySet<CandidateId>,
    final: boolean,
    dp: number,
  ): { movement: Movement; retained: Valued } {
    const movement: Movement = new Map();
    const retained: Valued = { value: 0n, fractional: false };
    for (const g of this.take(from)) {
      const moving = mulTrunc(g.weight, fraction, dp);
      retained.value += g.count * (g.weight - moving);
      retained.fractional = true;
      g.weight = moving;
      g.fractional = true;
      this.place(g, continuing, final);
      this.record(movement, g, g.count * moving);
    }
    return { movement, retained };
  }

  /** Ballots that rank the candidate anywhere within the allowed rankings. */
  rankedBallots(id: CandidateId): bigint {
    const { maxRankingsAllowed } = this.rules;
    let n = 0n;
    for (const g of this.groups) {
      const ranks = maxRankingsAllowed === 'max' ? g.ranking : g.ranking.slice(0, maxRankingsAllowed);
      if (ranks.some((slot) => slot.includes(id))) n += g.count;
    }
    return n;
  }

  private take(id: CandidateId): Group[] {
    const list = this.byCandidate.get(id) ?? [];
    this.byCandidate.delete(id);
    return list;
  }

  private place(g: Group, continuing: ReadonlySet<CandidateId>, final: boolean): void {
    const r = resolveChoice(g.ranking, continuing, this.candidates, this.rules);
    if (r.kind === 'vote') {
      g.at = r.candidate;
      g.bucket = null;
      const list = this.byCandidate.get(r.candidate);
      if (list) list.push(g);
      else this.byCandidate.set(r.candidate, [g]);
      return;
    }
    g.at = null;
    if (r.kind === 'undervote') g.bucket = 'undervote';
    else g.bucket = final ? 'finalRoundSurplus' : INACTIVE_KIND[r.reason];
  }

  private record(movement: Movement, g: Group, value: Fixed): void {
    if (value === 0n) return;
    addValued(movement as Map<string, Valued>, g.at ?? 'exhausted', value, g.fractional);
  }
}
