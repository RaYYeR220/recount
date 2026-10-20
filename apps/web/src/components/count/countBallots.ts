import { pairwise, pluralityWinner, presetRules, tabulate, toRctabSummary, type PresetId, type RctabSummary } from "@recount/engine";
import type { CountView } from "@/components/results/model";
import type { ParsedBallots } from "@/lib/ballotCsv";
import { serializeRounds } from "@/server/results/serialize";

export type CountOutcome = { ok: true; view: CountView; rctab: RctabSummary } | { ok: false; message: string };

/**
 * Counts pasted ballots with a jurisdiction's preset, exactly as POST /api/v1/tabulate
 * would: the candidates are the names in order of first appearance.
 */
export function countBallots(parsed: Pick<ParsedBallots, "candidates" | "ballots">, presetId: PresetId, seats: number): CountOutcome {
  if (seats > parsed.candidates.length) {
    return { ok: false, message: `There ${parsed.candidates.length === 1 ? "is 1 candidate" : `are ${parsed.candidates.length} candidates`} for ${seats} seats; add candidates or lower the seats.` };
  }
  const candidates = parsed.candidates.map((name) => ({ id: name, name }));
  const rules = presetRules(presetId, seats);
  let result;
  try {
    result = tabulate({ candidates, ballots: parsed.ballots, rules });
  } catch (error) {
    return { ok: false, message: error instanceof Error ? `The count stopped: ${error.message}.` : "The count stopped." };
  }
  if (result.rounds.length === 0) return { ok: false, message: "Every ballot is blank, so there is nothing to count." };
  return {
    ok: true,
    view: {
      rounds: serializeRounds(result),
      options: parsed.candidates,
      winners: result.winners,
      seats,
      totalBallots: result.totalBallots,
      pairwise: pairwise(candidates, parsed.ballots),
      pluralityWinner: pluralityWinner(candidates, parsed.ballots),
      rules,
      noun: "candidate",
    },
    rctab: toRctabSummary(result, { contest: "Pasted ballots", jurisdiction: "Recount count tool" }),
  };
}
