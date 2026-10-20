/**
 * Turns a count's rounds into a scene for the count table: trays, chits and where
 * every chit lies in every round. Each chit stands for `ballotsPerChit` ballots and
 * keeps its first-choice colour wherever it goes. Whole chits are dealt in round 1
 * by largest remainder and only ever move, so their number never changes. An STV
 * surplus leaves every chit of the elected option thinner and sends a sliver of it
 * onward; the slivers to each destination sum exactly to the engine's transfer.
 *
 * Input is the rounds as the results pages and the API carry them (decimal strings,
 * option labels as keys); roundsFromEngine() converts a TabulationResult.
 */
import type { TabulationResult } from "@recount/engine";
import { serializeRounds, type ResultRound } from "@/server/results/serialize";
import { apportion, apportionNumbers } from "./apportion";
import { describeRounds, type CaptionPart } from "./countCaptions";
import type { ChitKey } from "./optionColour";
import { formatDelta, formatUnits, fromUnits, sharedPlaces, toUnits } from "./votes";

export type { CaptionPart } from "./countCaptions";

/** One round as serialised for pages and the API. */
export type CountRound = ResultRound;

/** Engine rounds (bigint votes, candidate ids) in the serialised shape. */
export function roundsFromEngine(
  result: Pick<TabulationResult, "rounds" | "rules">,
  nameOf?: (id: string) => string,
): CountRound[] {
  return serializeRounds(result, nameOf);
}

export type CountTrayGroup = {
  /** Stable id, unique among groups. */
  id: string;
  /** Plaque name, e.g. "Adams +7". */
  label: string;
  members: readonly string[];
};

export type CountSceneInput = {
  rounds: readonly CountRound[];
  /** Option labels in ballot order; the order fixes each option's chit colour. */
  options: readonly string[];
  /** Seats to fill; above 1 the count is STV. Default 1. */
  seats?: number;
  /** Ballots one chit stands for. Default: the smallest round number that keeps the table to `maxChits`. */
  ballotsPerChit?: number;
  /** Upper bound on whole chits when ballotsPerChit is chosen automatically. Default 240. */
  maxChits?: number;
  /** Undeclared write-ins: cream chits. Default: labels that read like write-ins. */
  writeIns?: readonly string[];
  /** Options sharing one tray (minor candidates on a city-sized table). */
  groups?: readonly CountTrayGroup[];
  /** Shorter names for plaques, lamps and captions, keyed by label. */
  shortLabels?: Readonly<Record<string, string>>;
  /** What the choices are called in captions. Default "option". */
  noun?: "option" | "candidate";
};

export const INACTIVE_TRAY = "inactive";

export type TrayKind = "option" | "group" | "inactive";

export type SceneTray = {
  id: string;
  label: string;
  short: string;
  kind: TrayKind;
  /** Option labels counted in this tray (empty for inactive). */
  members: string[];
  /** Chit drawn on the plaque. */
  chit: ChitKey;
};

/** continuing; elected (at or before this round); out (eliminated in an earlier round); inactive. */
export type TrayState = "continuing" | "elected" | "out" | "inactive";

export type TrayRound = {
  /** Display figure for this round: engine string with separators ("573,169", "6.8000"). */
  tally: string;
  /** Exact engine string (sum of members for a group). */
  raw: string;
  /** "+1.8000" or "−3" against the previous round; null when unchanged or in round 1. */
  delta: string | null;
  state: TrayState;
  /** Plaque line: "first choices", a delta, "Eliminated", "Elected", "none yet", "no choices left". */
  meta: string;
};

export type SceneTransfer = {
  from: string;
  fromTray: string;
  kind: "elimination" | "surplus";
  to: Array<{
    /** Option label, or "Inactive". */
    target: string;
    tray: string | null;
    amount: string;
    /** Surplus with no seat left to go to (the trailing round). */
    setAside: boolean;
  }>;
};

export type SceneRound = {
  index: number;
  number: number;
  /** Short name for the round lamp: "First choices", "Sushi out", "Final round". */
  label: string;
  /** What changed coming into this round and what stands now, with figures marked. */
  caption: CaptionPart[];
  /** The extra round RCTab reports after the last seat fills. */
  trailing: boolean;
  threshold: string;
  activeTotal: string;
  inactive: string;
  /** Decided at the end of this round (engine meaning). */
  elected: string[];
  eliminated: string[];
  /** Transfers that moved into this round, i.e. the previous round's decisions. */
  incoming: SceneTransfer[];
  trays: Record<string, TrayRound>;
};

export type SceneChit = {
  id: number;
  chit: ChitKey;
  /** The chit this sliver came from; null for whole chits dealt in round 1. */
  parent: number | null;
  /** Round index in which it first lies on the table. */
  born: number;
};

export type ChitSpot = {
  tray: string;
  /** Position in the tray, in the order chits arrived. */
  index: number;
  /** 1 is a whole chit (ballotsPerChit ballots); slivers and thinned chits are less. */
  weight: number;
};

export type CountScene = {
  trays: SceneTray[];
  rounds: SceneRound[];
  chits: SceneChit[];
  /** spots[round][chitId]; null before a sliver is born. */
  spots: Array<Array<ChitSpot | null>>;
  ballotsPerChit: number;
  /** Whole chits dealt in round 1. */
  wholeChits: number;
  seats: number;
  multiSeat: boolean;
  winners: string[];
  /** Decimal places of the count's figures (0 when every figure is whole). */
  dp: number;
  /** "ballots" for single-winner counts, "votes" for STV. */
  unit: "ballots" | "votes";
  noun: "option" | "candidate";
};

/** 1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1,000 ... */
function* roundNumbers(): Generator<number> {
  for (let scale = 1; ; scale *= 10) {
    for (const m of [1, 2, 2.5, 5]) if (Number.isInteger(m * scale)) yield m * scale;
  }
}

/** Smallest round number of ballots per chit that keeps the table at or under `maxChits` whole chits. */
export function pickBallotsPerChit(ballots: number, maxChits = 240): number {
  for (const per of roundNumbers()) if (Math.ceil(ballots / per) <= maxChits) return per;
  return 1;
}

const WRITE_IN = /^(undeclared\s+)?write[\s-]?ins?$/i;

/** Labels that read as plural: "Write-ins" is eliminated, "they" move. */
export function isPluralLabel(label: string): boolean {
  return WRITE_IN.test(label.trim());
}

type Holder = string; // option label or INACTIVE_TRAY

export function buildCountScene(input: CountSceneInput): CountScene {
  const rounds = input.rounds;
  const seats = input.seats ?? 1;
  const multiSeat = seats > 1;
  const noun = input.noun ?? "option";

  const figures: string[] = [];
  for (const r of rounds) {
    figures.push(r.threshold, r.activeTotal, r.residualSurplus, ...Object.values(r.tally), ...Object.values(r.inactive));
    for (const t of r.transfers) figures.push(...Object.values(t.to));
  }
  const dp = sharedPlaces(figures);
  const U = (v: string | undefined) => (v === undefined ? 0n : toUnits(v, dp));
  const inactiveOf = (r: CountRound) => Object.values(r.inactive).reduce((a, v) => a + U(v), 0n);

  // ---------- options and trays ----------
  const labels = [...input.options];
  for (const r of rounds) for (const label of Object.keys(r.tally)) if (!labels.includes(label)) labels.push(label);
  const indexOf = new Map(labels.map((l, i) => [l, i]));
  const writeIns = new Set(input.writeIns ?? labels.filter((l) => WRITE_IN.test(l.trim())));
  const short = (label: string) => input.shortLabels?.[label] ?? label;
  const chitOf = (label: string): ChitKey => (writeIns.has(label) ? "writein" : indexOf.get(label)!);

  const trayOf = new Map<Holder, string>([[INACTIVE_TRAY, INACTIVE_TRAY]]);
  const trays: SceneTray[] = [];
  const groupOf = new Map<string, CountTrayGroup>();
  for (const g of input.groups ?? []) for (const m of g.members) groupOf.set(m, g);
  for (const label of labels) {
    const group = groupOf.get(label);
    if (group) {
      const id = `group-${group.id}`;
      trayOf.set(label, id);
      if (!trays.some((t) => t.id === id)) {
        trays.push({ id, label: group.label, short: group.label, kind: "group", members: [...group.members], chit: chitOf(group.members[0]!) });
      }
    } else {
      const id = `option-${indexOf.get(label)}`;
      trayOf.set(label, id);
      trays.push({ id, label, short: short(label), kind: "option", members: [label], chit: chitOf(label) });
    }
  }
  trays.push({ id: INACTIVE_TRAY, label: "Inactive", short: "Inactive", kind: "inactive", members: [], chit: "inactive" });

  const winners = rounds.flatMap((r) => r.elected);
  const unit = multiSeat ? "votes" : "ballots";

  if (rounds.length === 0) {
    return { trays, rounds: [], chits: [], spots: [], ballotsPerChit: input.ballotsPerChit ?? 1, wholeChits: 0, seats, multiSeat, winners, dp, unit, noun };
  }

  // ---------- round 1: deal whole chits ----------
  const first = rounds[0]!;
  const holders0: Holder[] = [...labels.filter((l) => first.tally[l] !== undefined), INACTIVE_TRAY];
  const values0 = holders0.map((h) => (h === INACTIVE_TRAY ? inactiveOf(first) : U(first.tally[h])));
  const counted = values0.reduce((a, v) => a + v, 0n);
  const scale = 10n ** BigInt(dp);
  const ballots = Number(counted / scale);
  const ballotsPerChit = input.ballotsPerChit ?? pickBallotsPerChit(ballots, input.maxChits);
  if (!Number.isInteger(ballotsPerChit) || ballotsPerChit < 1) throw new RangeError("ballotsPerChit must be a whole number >= 1");
  const chitUnits = BigInt(ballotsPerChit) * scale;
  const wholeChits = Number((counted * 2n + chitUnits) / (chitUnits * 2n));
  const dealt = apportion(wholeChits, values0);

  const chits: SceneChit[] = [];
  const weight: number[] = [];
  const holderOf: Holder[] = [];
  const held = new Map<Holder, number[]>();
  const trayList = new Map<string, number[]>(trays.map((t) => [t.id, []]));
  const hold = (h: Holder) => {
    let list = held.get(h);
    if (!list) held.set(h, (list = []));
    return list;
  };

  holders0.forEach((h, i) => {
    for (let k = 0; k < dealt[i]!; k++) {
      const id = chits.length;
      chits.push({ id, chit: h === INACTIVE_TRAY ? "inactive" : chitOf(h), parent: null, born: 0 });
      weight.push(1);
      holderOf.push(h);
      hold(h).push(id);
      trayList.get(trayOf.get(h)!)!.push(id);
    }
  });

  const spots: Array<Array<ChitSpot | null>> = [];
  const snapshot = () => {
    const row: Array<ChitSpot | null> = new Array(chits.length).fill(null);
    for (const [tray, list] of trayList) list.forEach((id, index) => (row[id] = { tray, index, weight: weight[id]! }));
    spots.push(row);
  };
  snapshot();

  const move = (id: number, to: Holder) => {
    const from = holderOf[id]!;
    const list = held.get(from)!;
    list.splice(list.indexOf(id), 1);
    hold(to).push(id);
    holderOf[id] = to;
    const a = trayOf.get(from)!;
    const b = trayOf.get(to)!;
    if (a !== b) {
      const src = trayList.get(a)!;
      src.splice(src.indexOf(id), 1);
      trayList.get(b)!.push(id);
    }
  };
  const destination = (target: string): Holder | null =>
    target === "exhausted" ? INACTIVE_TRAY : target === "residualSurplus" ? null : trayOf.has(target) ? target : null;
  const trayFor = (target: string): string | null => {
    const h = destination(target);
    return h === null ? null : trayOf.get(h)!;
  };
  const weightOf = (h: Holder) => (held.get(h) ?? []).reduce((a, id) => a + weight[id]!, 0);
  const valueIn = (r: CountRound, h: Holder) => (h === INACTIVE_TRAY ? inactiveOf(r) : U(r.tally[h]));

  /** Sends every chit of the eliminated options on as whole chits, aiming each receiver at its exact share. */
  const moveWholeChits = (sources: string[], amounts: Map<string, Map<Holder, bigint>>, round: CountRound) => {
    const inbound = new Map<Holder, bigint>();
    for (const row of amounts.values()) for (const [h, v] of row) inbound.set(h, (inbound.get(h) ?? 0n) + v);
    const receivers = [...inbound.keys()];
    const total = sources.reduce((n, s) => n + held.get(s)!.length, 0);
    const need = receivers.map((h) => Math.max(0, Number(valueIn(round, h)) / Number(chitUnits) - weightOf(h)));
    const quotas = need.some((n) => n > 0) ? need : receivers.map((h) => Number(inbound.get(h)!));
    const shares = apportionNumbers(total, quotas);
    const capacity = new Map(receivers.map((h, k) => [h, shares[k]!]));
    for (const s of sources) {
      const row = amounts.get(s)!;
      const rowTotal = Number([...row.values()].reduce((a, v) => a + v, 0n));
      const list = [...held.get(s)!];
      const given = new Map<Holder, number>();
      for (const id of list) {
        // Prefer where this source's ballots went; fall back to any tray still owed chits.
        let best: Holder = INACTIVE_TRAY;
        let bestScore = -Infinity;
        for (const h of receivers) {
          const room = capacity.get(h)!;
          if (room <= 0) continue;
          const score = row.has(h) ? (list.length * Number(row.get(h)!)) / rowTotal - (given.get(h) ?? 0) : room - 1e9;
          if (score > bestScore) {
            bestScore = score;
            best = h;
          }
        }
        capacity.set(best, (capacity.get(best) ?? 0) - 1);
        given.set(best, (given.get(best) ?? 0) + 1);
        move(id, best);
      }
    }
  };

  /** Chits of mixed weight (after a surplus): heaviest first, each to the destination furthest below its share. */
  const moveWeighted = (s: string, row: Map<Holder, bigint>) => {
    const given = new Map<Holder, number>();
    const list = [...held.get(s)!].sort((a, b) => weight[b]! - weight[a]! || a - b);
    for (const id of list) {
      let best: Holder = INACTIVE_TRAY;
      let bestGap = -Infinity;
      for (const [h, v] of row) {
        const gap = Number(v) / Number(chitUnits) - (given.get(h) ?? 0);
        if (gap > bestGap) {
          bestGap = gap;
          best = h;
        }
      }
      given.set(best, (given.get(best) ?? 0) + weight[id]!);
      move(id, best);
    }
  };

  /** Slivers of the elected option's chits; those reaching each destination sum to its transfer exactly. */
  const spawnSlivers = (objects: number[], dests: Array<[Holder, bigint]>, round: number) => {
    const feeders: number[][] = dests.map(() => []);
    if (objects.length >= dests.length) {
      const extra = apportion(objects.length - dests.length, dests.map(([, v]) => v));
      let at = 0;
      dests.forEach((_, k) => {
        const n = 1 + extra[k]!;
        feeders[k] = objects.slice(at, at + n);
        at += n;
      });
    } else {
      dests.forEach((_, k) => feeders[k]!.push(objects[k % objects.length]!));
    }
    dests.forEach(([h, v], k) => {
      const from = feeders[k]!;
      const fromWeight = from.reduce((a, id) => a + weight[id]!, 0);
      const units = Number(v) / Number(chitUnits);
      for (const parent of from) {
        const id = chits.length;
        chits.push({ id, chit: chits[parent]!.chit, parent, born: round });
        weight.push(fromWeight > 0 ? (units * weight[parent]!) / fromWeight : units / from.length);
        holderOf.push(h);
        hold(h).push(id);
        trayList.get(trayOf.get(h)!)!.push(id);
        for (const row of spots) row.push(null);
      }
    });
  };

  for (let i = 1; i < rounds.length; i++) {
    const prev = rounds[i - 1]!;
    const cur = rounds[i]!;
    const trailing = isTrailingRound(rounds, i, multiSeat);

    // Eliminations: every chit leaves the tray.
    const sources = prev.eliminated.filter((s) => (held.get(s)?.length ?? 0) > 0);
    if (sources.length > 0) {
      const amounts = new Map<string, Map<Holder, bigint>>();
      for (const s of sources) {
        const row = new Map<Holder, bigint>();
        const transfer = prev.transfers.find((t) => t.from === s);
        for (const [target, v] of Object.entries(transfer?.to ?? {})) {
          const h = destination(target);
          if (h !== null && U(v) > 0n) row.set(h, (row.get(h) ?? 0n) + U(v));
        }
        if (row.size === 0) row.set(INACTIVE_TRAY, 1n);
        amounts.set(s, row);
      }
      const whole = sources.every((s) => held.get(s)!.every((id) => weight[id] === 1));
      if (whole) moveWholeChits(sources, amounts, cur);
      else for (const s of sources) moveWeighted(s, amounts.get(s)!);
    }

    // Surpluses: every chit of the elected option thins and sends a sliver on.
    for (const transfer of prev.transfers) {
      if (!prev.elected.includes(transfer.from)) continue;
      const s = transfer.from;
      const objects = [...(held.get(s) ?? [])];
      const before = U(prev.tally[s]);
      const after = U(cur.tally[s]);
      const keep = before > 0n ? Number((after * 1_000_000n) / before) / 1_000_000 : 1;
      const dests: Array<[Holder, bigint]> = [];
      for (const [target, v] of Object.entries(transfer.to)) {
        // Once every seat is filled the surplus is set aside, not handed on.
        if (trailing && target === "exhausted") continue;
        const h = destination(target);
        if (h !== null && U(v) > 0n) dests.push([h, U(v)]);
      }
      if (objects.length > 0 && dests.length > 0) spawnSlivers(objects, dests, i);
      for (const id of objects) weight[id] = weight[id]! * keep;
    }

    snapshot();
  }

  // ---------- per-round tray figures, labels and captions ----------
  const electedAt = new Map<string, number>();
  const eliminatedAt = new Map<string, number>();
  rounds.forEach((r, i) => {
    for (const x of r.elected) electedAt.set(x, i);
    for (const x of r.eliminated) eliminatedAt.set(x, i);
  });

  const trayValue = (tray: SceneTray, r: CountRound): bigint | null => {
    if (tray.kind === "inactive") return inactiveOf(r);
    let sum: bigint | null = null;
    for (const m of tray.members) if (r.tally[m] !== undefined) sum = (sum ?? 0n) + U(r.tally[m]);
    return sum;
  };

  const described = describeRounds({ rounds, multiSeat, noun, unit, dp, short, isTrailing: (i) => isTrailingRound(rounds, i, multiSeat) });

  const sceneRounds: SceneRound[] = rounds.map((r, i) => {
    const prev = i > 0 ? rounds[i - 1]! : null;
    const trayRounds: Record<string, TrayRound> = {};
    for (const tray of trays) {
      const value = trayValue(tray, r);
      const before = prev ? trayValue(tray, prev) : null;
      const out = tray.kind !== "inactive" && value === null;
      const elected = tray.members.some((m) => electedAt.has(m) && electedAt.get(m)! <= i);
      const delta = i > 0 && value !== null ? formatDelta(value - (before ?? 0n), dp) : null;
      const state: TrayState = tray.kind === "inactive" ? "inactive" : out ? "out" : elected ? "elected" : "continuing";
      let meta: string;
      if (state === "inactive") meta = value === 0n ? "none yet" : (delta ?? "no choices left");
      else if (state === "out") meta = "Eliminated";
      else if (i === 0) meta = "first choices";
      else meta = delta ?? (state === "elected" ? "Elected" : "continuing");
      trayRounds[tray.id] = {
        tally: formatUnits(value ?? 0n, dp),
        raw: fromUnits(value ?? 0n, dp),
        delta,
        state,
        meta,
      };
    }
    const incoming: SceneTransfer[] = prev
      ? prev.transfers.map((t) => ({
          from: t.from,
          fromTray: trayOf.get(t.from) ?? INACTIVE_TRAY,
          kind: prev.elected.includes(t.from) ? ("surplus" as const) : ("elimination" as const),
          to: Object.entries(t.to)
            .filter(([target]) => target !== "residualSurplus")
            .map(([target, amount]) => {
              const setAside = target === "exhausted" && prev.elected.includes(t.from) && isTrailingRound(rounds, i, multiSeat);
              return {
                target: target === "exhausted" ? "Inactive" : target,
                tray: setAside ? null : trayFor(target),
                amount,
                setAside,
              };
            }),
        }))
      : [];
    return {
      index: i,
      number: i + 1,
      label: described[i]!.label,
      caption: described[i]!.caption,
      trailing: isTrailingRound(rounds, i, multiSeat),
      threshold: r.threshold,
      activeTotal: r.activeTotal,
      inactive: fromUnits(inactiveOf(r), dp),
      elected: [...r.elected],
      eliminated: [...r.eliminated],
      incoming,
      trays: trayRounds,
    };
  });

  return { trays, rounds: sceneRounds, chits, spots, ballotsPerChit, wholeChits, seats, multiSeat, winners, dp, unit, noun };
}

/** RCTab's extra round after the last seat fills: nothing decided, nothing moves on. */
export function isTrailingRound(rounds: readonly CountRound[], i: number, multiSeat: boolean): boolean {
  const r = rounds[i];
  return multiSeat && i > 0 && i === rounds.length - 1 && r !== undefined && r.elected.length === 0 && r.eliminated.length === 0;
}
