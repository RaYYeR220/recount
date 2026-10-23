/**
 * Ties the rules had to break, read back from the engine's rounds: options level
 * for last when one had to go, and options level when a seat went to one of them.
 * tieBreak() replays the engine's tiebreak (packages/engine/src/tiebreak.ts) so a
 * page can say how each tie was settled.
 */
import type { Rules } from "@recount/engine";
import type { ResultRound } from "@/server/results/serialize";
import { listNames } from "./names";
import { formatUnits, formatVotes, sharedPlaces, toUnits } from "./votes";

export type Tie = {
  /** "last": the tiebreak chose who was eliminated; "seat": who was elected. */
  kind: "last" | "seat";
  /** The round whose figures were level (1-based). */
  round: number;
  /** Everyone level, the tiebreak's choice first. */
  tied: string[];
  /** Eliminated ("last") or elected ("seat") by the tiebreak. */
  picked: string[];
  /** The level figure, for display. */
  at: string;
};

export function placesOfRounds(rounds: readonly ResultRound[]): number {
  const figures: string[] = [];
  for (const r of rounds) {
    figures.push(r.threshold, r.activeTotal, ...Object.values(r.tally), ...Object.values(r.inactive));
    for (const tr of r.transfers) figures.push(...Object.values(tr.to));
  }
  return sharedPlaces(figures);
}

/** Every tie the tiebreak settled, in round order. */
export function findTies(rounds: readonly ResultRound[]): Tie[] {
  const dp = placesOfRounds(rounds);
  const winners = new Set(rounds.flatMap((r) => r.elected));
  const elected = new Set<string>();
  const ties: Tie[] = [];
  rounds.forEach((r, i) => {
    const votes = (x: string) => toUnits(r.tally[x] ?? "0", dp);

    // A seat: someone elected this round level with someone who never took a seat.
    for (const level of new Set(r.elected.map(votes))) {
      const picked = r.elected.filter((x) => votes(x) === level);
      const rivals = Object.keys(r.tally).filter((x) => !winners.has(x) && !r.eliminated.includes(x) && votes(x) === level);
      if (rivals.length > 0) ties.push({ kind: "seat", round: i + 1, tied: [...picked, ...rivals], picked, at: formatUnits(level, dp) });
    }

    // Last place: someone eliminated level with someone who stayed in.
    const out = r.eliminated;
    if (out.length > 0) {
      const survivors = Object.keys(r.tally).filter((k) => !out.includes(k) && !elected.has(k) && !r.elected.includes(k));
      const top = out.reduce((m, x) => (votes(x) > m ? votes(x) : m), -1n);
      const level = survivors.filter((s) => votes(s) === top);
      if (level.length > 0) {
        const picked = out.filter((x) => votes(x) === top);
        ties.push({ kind: "last", round: i + 1, tied: [...picked, ...level], picked, at: formatUnits(top, dp) });
      }
    }
    r.elected.forEach((x) => elected.add(x));
  });
  return ties;
}

export type TieBreak =
  | { by: "ballotOrder" }
  | { by: "permutation" }
  /** A seeded draw among `among`; `levelBefore` is the earlier round they were also level in, if the rules looked. */
  | { by: "draw"; among: string[]; levelBefore: number | null }
  /** The previous round's counts set them apart. */
  | { by: "previousRound"; round: number; counts: Array<[string, string]> };

/** How the engine settled a tie under these rules. */
export function tieBreak(tie: Tie, rounds: readonly ResultRound[], rules: Pick<Rules, "tiebreakMode">): TieBreak {
  switch (rules.tiebreakMode) {
    case "useCandidateOrder":
      return { by: "ballotOrder" };
    case "generatePermutation":
      return { by: "permutation" };
    case "random":
      return { by: "draw", among: tie.tied, levelBefore: null };
    case "previousRoundCountsThenRandom": {
      // Round 1 has no previous round: the draw decides straight away.
      const before = rounds[tie.round - 2];
      if (!before) return { by: "draw", among: tie.tied, levelBefore: null };
      const dp = placesOfRounds(rounds);
      const votes = (x: string) => toUnits(before.tally[x] ?? "0", dp);
      const target = tie.tied.map(votes).reduce((m, v) => (tie.kind === "seat" ? (v > m ? v : m) : v < m ? v : m));
      const narrowed = tie.tied.filter((x) => votes(x) === target);
      if (narrowed.length > 1) return { by: "draw", among: narrowed, levelBefore: tie.round - 1 };
      return { by: "previousRound", round: tie.round - 1, counts: tie.tied.map((x) => [x, before.tally[x] ?? "0"]) };
    }
  }
}

/**
 * How a tie was settled, to follow "The tiebreak eliminated Cal": "by a draw seeded
 * from …" or "on round 2's counts, where Lisbon had 6 and Valencia 4".
 * `seed` says where draws come from; default "with seed <randomSeed>".
 */
export function tieBreakPhrase(
  tie: Tie,
  rounds: readonly ResultRound[],
  rules: Pick<Rules, "tiebreakMode" | "randomSeed">,
  seed = `with seed ${rules.randomSeed ?? "0"}`,
  show: (label: string) => string = (l) => l,
): string {
  const how = tieBreak(tie, rounds, rules);
  const picked = listNames(tie.picked.map(show));
  switch (how.by) {
    case "ballotOrder":
      return `by ballot order, as ${picked} ${tie.picked.length > 1 ? "are" : "is"} listed ${tie.kind === "seat" ? "earlier" : "later"}`;
    case "permutation":
      return `by a random order ${seed}`;
    case "draw": {
      if (how.levelBefore === null) return `by a draw ${seed}`;
      const who = how.among.length === tie.tied.length ? "they were" : `${listNames(how.among.map(show))} were`;
      return `by a draw ${seed}, as ${who} level in round ${how.levelBefore} too`;
    }
    case "previousRound": {
      const [head, ...rest] = how.counts;
      const counts = listNames([`${show(head![0])} had ${formatVotes(head![1])}`, ...rest.map(([x, v]) => `${show(x)} ${formatVotes(v)}`)]);
      return `on round ${how.round}'s counts, where ${counts}`;
    }
  }
}
