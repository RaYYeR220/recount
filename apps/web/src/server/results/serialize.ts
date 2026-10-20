import { formatFixed, type Fixed, type RoundResult, type TabulationResult } from "@recount/engine";

export type ResultRound = {
  round: number;
  tally: Record<string, string>;
  activeTotal: string;
  threshold: string;
  elected: string[];
  eliminated: string[];
  transfers: Array<{ from: string; to: Record<string, string> }>;
  inactive: Record<string, string>;
  residualSurplus: string;
  finalRoundSurplus?: string;
};

function mapRecord(record: Record<string, Fixed>, key: (k: string) => string, value: (v: Fixed) => string) {
  return Object.fromEntries(Object.entries(record).map(([k, v]) => [key(k), value(v)]));
}

/** Engine rounds with bigint votes turned into decimal strings and ids into display names. */
export function serializeRounds(
  result: Pick<TabulationResult, "rounds" | "rules">,
  nameOf: (id: string) => string = (id) => id,
): ResultRound[] {
  const dp = result.rules.decimalPlacesForVoteArithmetic;
  const num = (v: Fixed) => formatFixed(v, dp);
  const target = (t: string) => (t === "exhausted" || t === "residualSurplus" ? t : nameOf(t));

  return result.rounds.map((r: RoundResult) => ({
    round: r.round,
    tally: mapRecord(r.tally, nameOf, num),
    activeTotal: num(r.activeTotal),
    threshold: num(r.threshold),
    elected: r.elected.map(nameOf),
    eliminated: r.eliminated.map(nameOf),
    transfers: r.transfers.map((t) => ({ from: nameOf(t.from), to: mapRecord(t.to, target, num) })),
    inactive: mapRecord({ ...r.inactive }, (k) => k, num),
    residualSurplus: num(r.residualSurplus),
    ...(r.finalRoundSurplus === undefined ? {} : { finalRoundSurplus: num(r.finalRoundSurplus) }),
  }));
}
