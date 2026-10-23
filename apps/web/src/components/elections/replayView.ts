/**
 * A replay as the results components draw it: names in reading order ("Mary S.
 * Peltola"), options ordered by first choices so the strongest get the first chit
 * colours, and minor candidates sharing one tray ("Adams & 7 more") so a city-sized
 * table stays readable.
 */
import type { GoldenMismatch, GoldenRound } from "@recount/engine";
import type { CountView } from "@/components/results/model";
import { trayGroup, type CountSceneInput, type CountTrayGroup } from "@/lib/countScene";
import { OVERLAY_MAX_TRAYS } from "@/components/table/layout";
import { personName, surname } from "@/lib/names";
import { placesOf, toUnits } from "@/lib/votes";
import type { ElectionAnalysis } from "@/server/electionAnalysis";
import type { ElectionReplay } from "@/server/elections";
import type { ResultRound } from "@/server/results/serialize";

const SPECIAL = new Set(["exhausted", "residualSurplus"]);

function renameRounds(rounds: readonly ResultRound[], rename: (n: string) => string): ResultRound[] {
  const keys = <T>(record: Record<string, T>) => Object.fromEntries(Object.entries(record).map(([k, v]) => [SPECIAL.has(k) ? k : rename(k), v]));
  return rounds.map((r) => ({
    ...r,
    tally: keys(r.tally),
    elected: r.elected.map(rename),
    eliminated: r.eliminated.map(rename),
    transfers: r.transfers.map((t) => ({ from: rename(t.from), to: keys(t.to) })),
  }));
}

export type ReplayView = {
  view: CountView;
  scene: Omit<CountSceneInput, "rounds" | "options" | "seats">;
  /** Official figures under display names, with our mismatching cells. */
  official: { rounds: GoldenRound[]; winners: string[] } | null;
  mismatches: GoldenMismatch[];
};

export function replayView(replay: ElectionReplay, analysis: ElectionAnalysis): ReplayView {
  const rename = personName;
  const rounds = renameRounds(replay.rounds, rename);
  const writeIns = analysis.writeIns.map(rename);
  const first = rounds[0]?.tally ?? {};
  const votes = (name: string) => (first[name] === undefined ? -1n : toUnits(first[name], placesOf(first[name])));
  const byStrength = (a: string, b: string) => (votes(b) > votes(a) ? 1 : votes(b) < votes(a) ? -1 : 0);
  const people = analysis.contenders.map(rename).filter((n) => !writeIns.includes(n));
  const options = [...[...people].sort(byStrength), ...writeIns];
  const winners = replay.winners.map(rename);

  // Trays: individual candidates, then one shared tray, write-ins and inactive, at most OVERLAY_MAX_TRAYS.
  const groups: CountTrayGroup[] = [];
  const shortLabels: Record<string, string> = {};
  const room = OVERLAY_MAX_TRAYS - 1 - (writeIns.length > 0 ? 1 : 0);
  if (people.length > room) {
    const finalists = Object.keys(rounds.at(-1)?.tally ?? {}).filter((n) => people.includes(n) && votes(n) >= 0);
    const keep = new Set<string>(winners.filter((w) => people.includes(w)));
    for (const n of [...finalists].sort(byStrength)) if (keep.size < Math.max(room - 1, winners.length)) keep.add(n);
    for (const n of options) if (!writeIns.includes(n) && keep.size < Math.max(room - 1, winners.length)) keep.add(n);
    const minor = options.filter((n) => !keep.has(n) && !writeIns.includes(n));
    if (minor.length > 1) groups.push(trayGroup("others", surname(minor[0]!), minor));
  }
  for (const n of options) shortLabels[n] = writeIns.includes(n) ? (n.length > 12 ? "Write-ins" : n) : surname(n);

  const matrix = Object.fromEntries(
    Object.entries(analysis.pairwise.matrix).map(([a, row]) => [rename(a), Object.fromEntries(Object.entries(row).map(([b, n]) => [rename(b), n]))]),
  );

  return {
    view: {
      rounds,
      options,
      winners,
      seats: replay.seats,
      totalBallots: replay.totalBallots,
      pairwise: {
        matrix,
        condorcetWinner: analysis.pairwise.condorcetWinner && rename(analysis.pairwise.condorcetWinner),
        condorcetLoser: analysis.pairwise.condorcetLoser && rename(analysis.pairwise.condorcetLoser),
      },
      pluralityWinner: analysis.pluralityWinner && rename(analysis.pluralityWinner),
      rules: replay.rules,
      writeIns,
      noun: "candidate",
      shortLabels,
    },
    scene: { groups, shortLabels, writeIns, noun: "candidate" },
    official: analysis.official
      ? {
          rounds: analysis.official.rounds.map((r) => ({ ...r, tally: Object.fromEntries(Object.entries(r.tally).map(([k, v]) => [rename(k), v])) })),
          winners: analysis.official.winners.map(rename),
        }
      : null,
    mismatches: (replay.comparison?.mismatches ?? []).map((m) => ({
      ...m,
      candidate: m.candidate === "winners" || m.candidate === "inactive" || m.candidate === "exhausted" ? m.candidate : rename(m.candidate),
    })),
  };
}
