import type { PairwiseResult, Rules } from "@recount/engine";
import { isPluralLabel } from "@/lib/countScene";
import type { ChitKey } from "@/lib/optionColour";
import type { ResultRound } from "@/server/results/serialize";

/** A finished count as the results components draw it: a poll, a pasted count or a replay. */
export type CountView = {
  rounds: ResultRound[];
  /** Option labels in ballot order; the order fixes each option's chit. */
  options: string[];
  winners: string[];
  seats: number;
  totalBallots: number;
  pairwise: PairwiseResult;
  pluralityWinner: string | null;
  rules: Rules;
  /** Undeclared write-ins (cream chits). Default: labels that read like write-ins. */
  writeIns?: string[];
  noun?: "option" | "candidate";
  /** Short names where full ones do not fit (matrix headings), keyed by label. */
  shortLabels?: Record<string, string>;
};

/** The chit an option is drawn with, matching the count table. */
export function chitOf(label: string, view: Pick<CountView, "options" | "writeIns">): ChitKey {
  if (label === "exhausted" || label === "Inactive") return "inactive";
  const writeIn = view.writeIns ? view.writeIns.includes(label) : isPluralLabel(label);
  if (writeIn) return "writein";
  const i = view.options.indexOf(label);
  return i >= 0 ? i : "writein";
}

export function roundsWord(n: number): string {
  return `${n} ${n === 1 ? "round" : "rounds"}`;
}
