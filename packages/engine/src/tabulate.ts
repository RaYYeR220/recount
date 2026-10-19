import { batchLosers } from './batch';
import { divTrunc, type Fixed, makeScale } from './fixed';
import { addValued, BallotPool, type Movement, type Valued } from './pool';
import type { RoundResult, TabulationInput, TabulationResult, Transfer, TransferTarget } from './result';
import { isMultiWinner, type Rules } from './rules';
import { computeThreshold, type Threshold } from './threshold';
import { createTiebreaker, type Tiebreaker } from './tiebreak';
import type { Candidate, CandidateId } from './types';
import { record, validateInput } from './validate';

type Next = 'continue' | 'stop' | 'trailing';

const byCodeUnits = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function tabulate(input: TabulationInput): TabulationResult {
  return new Count(input).run();
}

class Count {
  private readonly rules: Rules;
  private readonly candidates: Candidate[];
  private readonly byId: Map<CandidateId, Candidate>;
  private readonly order: CandidateId[];
  private readonly continuing: Set<CandidateId>;
  private readonly pool: BallotPool;
  private readonly tiebreak: Tiebreaker;
  private readonly dp: number;
  private readonly multi: boolean;
  private readonly rounds: RoundResult[] = [];
  private readonly winners: CandidateId[] = [];
  private readonly held = new Map<CandidateId, Valued>();
  /** Minneapolis: reached the threshold, surplus not moved yet, still receiving votes. */
  private readonly pending: CandidateId[] = [];
  private frozen: Threshold | null = null;
  private residual = 0n;

  constructor({ candidates, ballots, rules }: TabulationInput) {
    validateInput(candidates, ballots);
    this.rules = rules;
    this.candidates = candidates;
    this.byId = new Map(candidates.map((c) => [c.id, c]));
    this.order = candidates.filter((c) => !c.excluded && !c.countsOnlyForOvervote).map((c) => c.id);
    this.continuing = new Set(this.order);
    this.dp = rules.decimalPlacesForVoteArithmetic;
    this.multi = isMultiWinner(rules);
    this.pool = new BallotPool(ballots, this.byId, rules, this.continuing, makeScale(this.dp));
    this.tiebreak = createTiebreaker(candidates, rules);
  }

  run(): TabulationResult {
    if (this.pool.totalBallots > 0n && this.order.length > 0) this.loop();
    return {
      rounds: this.rounds,
      winners: this.winners,
      totalBallots: Number(this.pool.totalBallots),
      undervotes: Number(this.pool.undervotes),
      rules: this.rules,
      candidates: this.candidates,
    };
  }

  private loop(): void {
    let trailing = false;
    for (let round = 1; ; round++) {
      if (round > this.order.length * 2 + 4) throw new Error('tabulation did not finish');
      const rec = this.openRound(round);
      if (trailing || (round === 1 && rec.activeTotal === 0n)) break;
      const next = this.multi ? (this.rules.deferSurplus ? this.decideMinneapolis(rec) : this.decideStv(rec)) : this.decideIrv(rec);
      if (next === 'stop') break;
      trailing = next === 'trailing';
    }
    if (this.multi) {
      const last = this.rounds[this.rounds.length - 1]!;
      const surplus = this.pool.snapshot().finalRoundSurplus;
      last.finalRoundSurplus = surplus.value;
      last.fractional.finalRoundSurplus = surplus.fractional;
    }
  }

  private openRound(round: number): RoundResult {
    const snap = this.pool.snapshot();
    const tally = record<Fixed>();
    const fractionalTally: CandidateId[] = [];
    let activeTotal = 0n;
    for (const id of this.order) {
      const v = this.held.get(id) ?? (this.continuing.has(id) ? (snap.tally.get(id) ?? { value: 0n, fractional: false }) : null);
      if (!v) continue;
      tally[id] = v.value;
      activeTotal += v.value;
      if (v.fractional) fractionalTally.push(id);
    }
    const threshold = this.frozen ?? computeThreshold(activeTotal, this.rules);
    if (round === 1 && (this.multi || this.rules.firstRoundDeterminesThreshold)) this.frozen = threshold;

    const inactiveKinds = ['overvotes', 'skippedRankings', 'repeatedRankings', 'exhaustedChoices'] as const;
    const rec: RoundResult = {
      round,
      tally,
      activeTotal,
      threshold: threshold.value,
      elected: [],
      eliminated: [],
      transfers: [],
      inactive: {
        overvotes: snap.inactive.overvotes.value,
        skippedRankings: snap.inactive.skippedRankings.value,
        repeatedRankings: snap.inactive.repeatedRankings.value,
        exhaustedChoices: snap.inactive.exhaustedChoices.value,
      },
      residualSurplus: this.residual,
      fractional: {
        threshold: threshold.fractional,
        tally: fractionalTally,
        inactive: inactiveKinds.filter((k) => snap.inactive[k].fractional),
        transfers: record<TransferTarget[]>(),
        finalRoundSurplus: false,
      },
    };
    this.rounds.push(rec);
    return rec;
  }

  private decideIrv(rec: RoundResult): Next {
    const cont = this.live();
    const threshold = rec.threshold;
    const winner = this.winners[0];
    if (winner !== undefined) {
      if (cont.length <= 2) return 'stop';
      this.eliminate(rec, this.losers(rec, cont, 2));
      return 'continue';
    }

    const writeIns = this.writeIns(cont);
    if (writeIns.length > 0) {
      this.eliminate(rec, writeIns);
      return 'continue';
    }

    const over = cont.filter((id) => rec.tally[id]! >= threshold);
    const elected = over.length > 0 ? this.top(rec, over) : cont.length > 0 && cont.length <= 2 ? this.top(rec, cont) : null;
    if (elected !== null) {
      rec.elected.push(elected);
      this.winners.push(elected);
      if (!this.rules.continueUntilTwoCandidatesRemain || cont.length <= 2) return 'stop';
      this.frozen = { value: threshold, fractional: rec.fractional.threshold };
      return 'continue';
    }
    if (cont.length === 0) return 'stop';
    this.eliminate(rec, this.losers(rec, cont, 2));
    return 'continue';
  }

  private decideStv(rec: RoundResult): Next {
    const cont = this.live();
    const writeIns = this.writeIns(cont);
    if (writeIns.length > 0) {
      this.eliminate(rec, writeIns);
      return 'continue';
    }

    const seatsLeft = this.rules.numberOfWinners - this.winners.length;
    let newly = this.overThreshold(rec, cont, seatsLeft);
    const rest = cont.filter((id) => !newly.includes(id));
    if (rest.length > 0 && rest.length <= seatsLeft - newly.length) newly = [...newly, ...rest];

    if (newly.length === 0) {
      if (cont.length === 0) return 'stop';
      this.eliminate(rec, [this.lowest(rec, cont)]);
      return 'continue';
    }

    for (const id of newly) this.continuing.delete(id);
    this.winners.push(...this.sortByName(newly));
    rec.elected.push(...this.sortByName(newly));
    const filled = this.winners.length >= this.rules.numberOfWinners;
    if (!filled && this.continuing.size === 0) return 'stop';
    for (const id of this.sortByName(newly)) this.distributeSurplus(rec, id, filled);
    return filled ? 'trailing' : 'continue';
  }

  /** Minneapolis Code ch. 167.70: defeat hopeless candidates before moving any surplus. */
  private decideMinneapolis(rec: RoundResult): Next {
    const threshold = rec.threshold;
    const cont = this.live();
    for (const id of cont) {
      if (rec.tally[id]! >= threshold && !this.pending.includes(id)) this.pending.push(id);
    }
    const seatsLeft = this.rules.numberOfWinners - this.winners.length;
    if (this.pending.length >= seatsLeft) {
      const chosen = [...this.pending].sort((a, b) => cmpDesc(rec.tally[a]!, rec.tally[b]!)).slice(0, seatsLeft);
      this.electNow(rec, chosen);
      return 'stop';
    }

    const hopeful = cont.filter((id) => !this.pending.includes(id));
    const open = seatsLeft - this.pending.length;
    if (hopeful.length <= open) {
      this.electNow(rec, [...this.pending, ...hopeful]);
      return 'stop';
    }

    const slack = this.pending.reduce((s, id) => s + rec.tally[id]! - threshold, 0n);
    let defeated = this.hopeless(rec, cont, hopeful, slack, seatsLeft, open);
    if (defeated.length === 0 && this.pending.length > 0) {
      const largest = this.top(rec, this.pending);
      this.pending.splice(this.pending.indexOf(largest), 1);
      this.continuing.delete(largest);
      this.winners.push(largest);
      rec.elected.push(largest);
      this.distributeSurplus(rec, largest, false);
      return 'continue';
    }
    if (defeated.length === 0) defeated = [this.lowest(rec, hopeful)];
    this.eliminate(rec, defeated);

    const left = hopeful.filter((id) => !defeated.includes(id));
    if (left.length <= open) {
      this.electNow(rec, [...this.pending, ...left]);
      return 'stop';
    }
    return 'continue';
  }

  /**
   * Both "mathematically impossible" tests from Minneapolis Code 167.20: a candidate who
   * cannot catch the next one up even with every lower vote and all surplus, and a candidate
   * ranked on fewer ballots than the votes already held by the last candidate in a winning
   * position. Everyone below a hopeless candidate is hopeless too.
   */
  private hopeless(
    rec: RoundResult,
    cont: CandidateId[],
    hopeful: CandidateId[],
    slack: Fixed,
    seatsLeft: number,
    open: number,
  ): CandidateId[] {
    const keep = Math.max(open, 1);
    const batch = batchLosers(
      hopeful.map((id) => [id, rec.tally[id]!] as const),
      slack,
      keep,
    );
    const scale = makeScale(this.dp);
    const standing = [...cont].sort((a, b) => cmpDesc(rec.tally[a]!, rec.tally[b]!));
    const last = standing[seatsLeft - 1];
    const bar = last === undefined ? null : rec.tally[last]!;
    const impossible = new Set(batch);
    if (bar !== null) {
      for (const id of hopeful) if (this.pool.rankedBallots(id) * scale < bar) impossible.add(id);
    }
    if (impossible.size === 0) return [];
    const cutoff = [...impossible].reduce((m, id) => (rec.tally[id]! > m ? rec.tally[id]! : m), 0n);
    const out = hopeful.filter((id) => impossible.has(id) || rec.tally[id]! < cutoff);
    return out.length <= hopeful.length - keep ? out : batch;
  }

  private electNow(rec: RoundResult, ids: CandidateId[]): void {
    const sorted = this.sortByName(ids);
    for (const id of sorted) {
      this.continuing.delete(id);
      const at = this.pending.indexOf(id);
      if (at >= 0) this.pending.splice(at, 1);
    }
    this.winners.push(...sorted);
    rec.elected.push(...sorted);
  }

  private overThreshold(rec: RoundResult, cont: CandidateId[], seatsLeft: number): CandidateId[] {
    const over = cont.filter((id) => rec.tally[id]! >= rec.threshold);
    if (over.length <= 1) return over;
    if (this.rules.winnerElectionMode === 'multiWinnerAllowOnlyOneWinnerPerRound') return [this.top(rec, over)];
    return [...over].sort((a, b) => cmpDesc(rec.tally[a]!, rec.tally[b]!)).slice(0, Math.max(seatsLeft, 0));
  }

  private distributeSurplus(rec: RoundResult, id: CandidateId, final: boolean): void {
    const total = rec.tally[id]!;
    const threshold: Valued = { value: rec.threshold, fractional: rec.fractional.threshold };
    const surplus = total - threshold.value;
    const fraction = surplus > 0n ? divTrunc(surplus, total, this.dp) : 0n;
    const { movement, retained } = this.pool.moveSurplus(id, fraction, this.continuing, final, this.dp);
    const capped = !this.rules.deferSurplus && retained.value > threshold.value;
    const held = capped ? threshold : retained;
    if (capped) {
      const residual = retained.value - threshold.value;
      this.residual += residual;
      addValued(movement as Map<string, Valued>, 'residualSurplus', residual, true);
    }
    this.held.set(id, held);
    this.pushTransfer(rec, id, movement);
  }

  private eliminate(rec: RoundResult, ids: CandidateId[]): void {
    for (const id of ids) this.continuing.delete(id);
    const moved = this.pool.move(new Set(ids), this.continuing);
    for (const id of this.sortByName(ids)) {
      rec.eliminated.push(id);
      this.pushTransfer(rec, id, moved.get(id) ?? new Map());
    }
  }

  private pushTransfer(rec: RoundResult, from: CandidateId, movement: Movement): void {
    const to = record<Fixed>();
    const fractional: TransferTarget[] = [];
    for (const [target, v] of movement) {
      to[target] = v.value;
      if (v.fractional) fractional.push(target);
    }
    const transfer: Transfer = { from, to };
    rec.transfers.push(transfer);
    rec.fractional.transfers[from] = fractional;
  }

  private losers(rec: RoundResult, cont: CandidateId[], keep: number): CandidateId[] {
    if (this.rules.batchElimination) {
      const batch = batchLosers(
        cont.map((id) => [id, rec.tally[id]!] as const),
        0n,
        keep,
      );
      if (batch.length > 0) return batch;
    }
    return [this.lowest(rec, cont)];
  }

  private lowest(rec: RoundResult, ids: CandidateId[]): CandidateId {
    const low = ids.reduce((m, id) => (rec.tally[id]! < m ? rec.tally[id]! : m), rec.tally[ids[0]!]!);
    const tied = ids.filter((id) => rec.tally[id] === low);
    return tied.length === 1 ? tied[0]! : this.tiebreak.loser(tied, this.previousTally());
  }

  private top(rec: RoundResult, ids: CandidateId[]): CandidateId {
    const high = ids.reduce((m, id) => (rec.tally[id]! > m ? rec.tally[id]! : m), rec.tally[ids[0]!]!);
    const tied = ids.filter((id) => rec.tally[id] === high);
    return tied.length === 1 ? tied[0]! : this.tiebreak.winner(tied, this.previousTally());
  }

  private previousTally(): Record<CandidateId, Fixed> | undefined {
    return this.rounds.length >= 2 ? this.rounds[this.rounds.length - 2]!.tally : undefined;
  }

  private writeIns(cont: CandidateId[]): CandidateId[] {
    if (!this.rules.eliminateWriteInsFirst) return [];
    const found = cont.filter((id) => this.byId.get(id)?.isWriteIn);
    return found.length < cont.length ? found : [];
  }

  private live(): CandidateId[] {
    return this.order.filter((id) => this.continuing.has(id));
  }

  private sortByName(ids: readonly CandidateId[]): CandidateId[] {
    const name = (id: CandidateId) => this.byId.get(id)?.name ?? id;
    return [...ids].sort((a, b) => byCodeUnits(name(a), name(b)));
  }
}

function cmpDesc(a: Fixed, b: Fixed): number {
  return a > b ? -1 : a < b ? 1 : 0;
}
