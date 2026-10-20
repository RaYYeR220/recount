import {
  assertCandidateId,
  pairwise,
  pluralityWinner,
  presetRules,
  PRESETS,
  tabulate,
  toRctabSummary,
  type BallotPattern,
  type PresetId,
  type RctabSummary,
  type Rules,
} from "@recount/engine";
import { z } from "zod";
import { serializeRounds, type ResultRound } from "./results/serialize";
import { parseOrThrow, validationError } from "./validation";

export const MAX_PATTERNS = 10_000;

function isCandidateName(name: string): boolean {
  try {
    assertCandidateId(name);
    return true;
  } catch {
    return false;
  }
}

const slot = z.union([z.string().max(200), z.array(z.string().max(200)).max(50)]);

const ruleOverrides = z
  .object({
    winnerElectionMode: z.enum([
      "singleWinnerMajority",
      "multiWinnerAllowOnlyOneWinnerPerRound",
      "multiWinnerAllowMultipleWinnersPerRound",
    ]),
    overvoteRule: z.enum(["exhaustImmediately", "alwaysSkipToNextRank", "exhaustIfMultipleContinuing"]),
    maxSkippedRanksAllowed: z.union([z.number().int().min(0), z.literal("unlimited")]),
    maxRankingsAllowed: z.union([z.number().int().min(1), z.literal("max")]),
    exhaustOnDuplicateCandidate: z.boolean(),
    batchElimination: z.boolean(),
    continueUntilTwoCandidatesRemain: z.boolean(),
    tiebreakMode: z.enum(["useCandidateOrder", "random", "previousRoundCountsThenRandom", "generatePermutation"]),
    randomSeed: z.string().regex(/^-?\d{1,19}$/, "A Java long in decimal"),
    decimalPlacesForVoteArithmetic: z.number().int().min(0).max(8),
    nonIntegerWinningThreshold: z.boolean(),
    hareQuota: z.boolean(),
    firstRoundDeterminesThreshold: z.boolean(),
    deferSurplus: z.boolean(),
    eliminateWriteInsFirst: z.boolean(),
  })
  .partial();

export const tabulateInputSchema = z.object({
  contest: z.string().trim().min(1).max(200).default("Tabulation"),
  candidates: z
    .array(z.string().trim().min(1).max(200).refine(isCandidateName, "This candidate name is reserved"))
    .min(1)
    .max(1000)
    .refine((names) => new Set(names).size === names.length, "Candidate names must be unique")
    .describe("Candidate names; ballots refer to candidates by these names."),
  ballots: z
    .array(
      z.object({
        ranking: z
          .array(slot)
          .max(500)
          .describe('One entry per rank: a name, "" or [] for a skipped rank, or several names for an overvote.'),
        count: z.number().int().min(1).max(1_000_000_000).default(1),
      }),
    )
    .min(1)
    .max(MAX_PATTERNS),
  presetId: z
    .enum(Object.keys(PRESETS) as [PresetId, ...PresetId[]])
    .default("recount-standard"),
  seats: z.number().int().min(1).max(100).default(1),
  rules: ruleOverrides.optional().describe("RCTab rule options that override the preset."),
});

export type TabulateInput = z.input<typeof tabulateInputSchema>;

export type TabulationOutput = {
  totalBallots: number;
  undervotes: number;
  candidates: string[];
  rounds: ResultRound[];
  winners: string[];
  condorcetWinner: string | null;
  pluralityWinner: string | null;
  rules: Rules;
};

export function runTabulation(input: unknown): { output: TabulationOutput; rctab: RctabSummary } {
  const data = parseOrThrow(tabulateInputSchema, input);
  const rules: Rules = { ...presetRules(data.presetId, data.seats), ...data.rules };
  const candidates = data.candidates.map((name) => ({ id: name, name }));
  const ballots: BallotPattern[] = data.ballots.map(({ ranking, count }) => ({
    ranking: ranking.map((s) => (typeof s === "string" ? (s === "" ? [] : [s]) : s)),
    count,
  }));

  let result;
  try {
    result = tabulate({ candidates, ballots, rules });
  } catch (error) {
    if (error instanceof TypeError || error instanceof RangeError) {
      throw validationError({ path: "ballots", message: error.message });
    }
    throw error;
  }

  const matrix = pairwise(candidates, ballots);
  return {
    output: {
      totalBallots: result.totalBallots,
      undervotes: result.undervotes,
      candidates: data.candidates,
      rounds: serializeRounds(result),
      winners: result.winners,
      condorcetWinner: matrix.condorcetWinner,
      pluralityWinner: pluralityWinner(candidates, ballots),
      rules,
    },
    rctab: toRctabSummary(result, { contest: data.contest }),
  };
}
