import type { Golden, ReportConvention } from "@recount/engine";
import { isPluralLabel, pickBallotsPerChit, type CountRound, type CountTrayGroup } from "@/lib/countScene";
import type { ChitKey } from "@/lib/optionColour";
import { formatCount, formatVotes, fromUnits, sharedPlaces, toUnits } from "@/lib/votes";
import type { ElectionReplay } from "@/server/elections";

/** What the hero's count table is built from: small enough to ship, the scene is made in the browser. */
export type HeroTableInput = {
  /** The contest, e.g. "New York City 2025 Democratic primary for Mayor". */
  name: string;
  /** Accessible name of the table and its data table. */
  title: string;
  rounds: CountRound[];
  options: string[];
  groups: CountTrayGroup[];
  shortLabels: Record<string, string>;
  ballotsPerChit: number;
  footnote: string;
};

export type ProofRow = { label: string; chit: ChitKey; figure: string; matches: boolean };

export type HeroProof = {
  publisher: string;
  /** "Democratic primary for Mayor, June 24, 2025. Certified July 22, 2025." */
  contest: string;
  matched: number;
  cells: number;
  ballots: string;
  /** The final round as the official report prints it, each checked against the replay. */
  rows: ProofRow[];
  /** How the report counts inactive ballots, when that leaves some out. */
  note: string | null;
  href: string;
};

export type HeroData = { table: HeroTableInput; proof: HeroProof };

/** Trays of their own; everyone else shares one. */
const OWN_TRAYS = 3;

const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

/** "Zohran Kwame Mamdani" → "Mamdani". */
export function surname(name: string): string {
  if (isPluralLabel(name)) return name;
  return name.trim().split(/\s+/).at(-1)!;
}

/**
 * Inactive ballots the way the official report counts them. Reports that leave out
 * ballots already inactive in round 1 (NYC: overvotes on the first rank) count from
 * there, so every figure on the table is one the report prints.
 */
export function reportedRounds(rounds: readonly CountRound[], convention: ReportConvention["inactive"]): CountRound[] {
  const first = rounds[0];
  if (convention !== "afterFirstRound" || !first) return [...rounds];
  const dp = sharedPlaces(rounds.flatMap((r) => Object.values(r.inactive)));
  return rounds.map((r) => ({
    ...r,
    inactive: Object.fromEntries(
      Object.entries(r.inactive).map(([kind, v]) => [kind, fromUnits(toUnits(v, dp) - toUnits(first.inactive[kind] ?? "0", dp), dp)]),
    ),
  }));
}

const KIND_NAMES: Record<string, string> = {
  overvotes: "overvoted",
  skippedRankings: "with skipped rankings",
  repeatedRankings: "with repeated rankings",
  exhaustedChoices: "with no choices left",
};

export function buildHeroData(replay: ElectionReplay, golden: Golden, href: string): HeroData {
  const { rounds, candidates } = replay;
  const first = rounds[0];
  const lastGolden = golden.rounds.at(-1);
  if (!first || !lastGolden || !replay.comparison) throw new Error(`${replay.slug}: nothing to show in the hero`);

  // Trays: the leaders on round 1 get their own, the rest share one, write-ins stay apart.
  const tallyDp = sharedPlaces(Object.values(first.tally));
  const firstOf = (c: string) => toUnits(first.tally[c] ?? "0", tallyDp);
  const byFirst = (a: string, b: string) => (firstOf(b) > firstOf(a) ? 1 : firstOf(b) < firstOf(a) ? -1 : 0);
  const declared = candidates.filter((c) => !isPluralLabel(c));
  const ranked = [...declared].sort(byFirst);
  const own = new Set(ranked.slice(0, OWN_TRAYS));
  const shared = declared.filter((c) => !own.has(c));
  const shortLabels = Object.fromEntries(candidates.map((c) => [c, surname(c)]));
  const groups: CountTrayGroup[] =
    shared.length > 1 ? [{ id: "others", label: `${surname([...shared].sort(byFirst)[0]!)} +${shared.length - 1}`, members: shared }] : [];

  const table = reportedRounds(rounds, replay.reportConvention.inactive);
  const counted = Number(toUnits(table[0]!.activeTotal, tallyDp) / 10n ** BigInt(tallyDp));
  const ballotsPerChit = pickBallotsPerChit(counted, 450);

  const leftOff = Object.entries(first.inactive).filter(([, v]) => !/^0(\.0*)?$/.test(v));
  const dp = sharedPlaces(leftOff.map(([, v]) => v));
  const leftOffTotal = leftOff.reduce((a, [, v]) => a + toUnits(v, dp), 0n);
  const kind = leftOff.length === 1 ? (KIND_NAMES[leftOff[0]![0]] ?? "inactive") : "inactive";
  const note =
    replay.reportConvention.inactive === "afterFirstRound" && leftOffTotal > 0n
      ? `Inactive is counted the way the report counts it, leaving out the ${formatVotes(fromUnits(leftOffTotal, dp))} ballots ${kind} in round 1. The table does the same.`
      : null;
  const footnote = `Each chit is ${formatCount(ballotsPerChit)} ballots and keeps its first-choice colour. Face down means no choices left. Plates show exact counts.`;

  // Proof: the report's final round, largest first, inactive last.
  const finalRound = lastGolden.round;
  const missed = (name: string) => replay.comparison!.mismatches.some((m) => m.round === finalRound && m.candidate === name);
  const goldenDp = sharedPlaces(Object.values(lastGolden.tally));
  const rows: ProofRow[] = Object.entries(lastGolden.tally)
    .sort(([, a], [, b]) => (toUnits(b, goldenDp) > toUnits(a, goldenDp) ? 1 : -1))
    .map(([name, figure]) => ({ label: surname(name), chit: Math.max(0, candidates.indexOf(name)), figure: formatVotes(figure), matches: !missed(name) }));
  const inactive = lastGolden.inactive ?? lastGolden.exhausted;
  if (inactive !== undefined) {
    const kind = lastGolden.inactive !== undefined ? "inactive" : "exhausted";
    rows.push({ label: "Inactive", chit: "inactive", figure: formatVotes(inactive), matches: !missed(kind) });
  }

  const certified = /certified ([A-Z][a-z]+ \d{1,2}, \d{4})/i.exec(replay.golden?.notes ?? "")?.[1];
  // "New York City 2025 Democratic primary for Mayor" → "Democratic primary for Mayor"
  const year = ` ${replay.date.slice(0, 4)} `;
  const at = replay.title.indexOf(year);
  const contestName = at >= 0 ? replay.title.slice(at + year.length) : replay.title;
  const contest = `${contestName.charAt(0).toUpperCase()}${contestName.slice(1)}, ${longDate(replay.date)}.${certified ? ` Certified ${certified}.` : ""}`;

  return {
    table: {
      name: replay.title,
      title: `${replay.title}: the count, round by round`,
      rounds: table,
      options: candidates,
      groups,
      shortLabels,
      ballotsPerChit,
      footnote,
    },
    proof: {
      publisher: replay.source.publisher,
      contest,
      matched: replay.comparison.cells - replay.comparison.mismatches.length,
      cells: replay.comparison.cells,
      ballots: formatCount(replay.totalBallots),
      rows,
      note,
      href,
    },
  };
}
