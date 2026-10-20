import { PRESETS, presetRules, tabulate, toRctabSummary, type PresetId } from "@recount/engine";
import { lunchRequest } from "@/components/landing/apiExample";

export type EngineExample = { code: string; presets: PresetId[] };

/**
 * A short program against @recount/engine, with the values it prints filled in by
 * running exactly that program while the page is built.
 */
export function buildEngineExample(): EngineExample {
  const { candidates, ballots } = lunchRequest();
  const result = tabulate({
    candidates: candidates.map((name) => ({ id: name, name })),
    ballots: ballots.map((b) => ({ ranking: b.ranking.map((c) => [c]), count: b.count })),
    rules: presetRules("recount-standard", 1),
  });
  const summary = toRctabSummary(result, { contest: "Lunch" });
  const last = summary.results.at(-1)!;

  const candidateList = candidates.map((c) => `{ id: "${c}", name: "${c}" }`).join(", ");
  const ballotLines = ballots.map((b) => `    { ranking: [${b.ranking.map((c) => `["${c}"]`).join(", ")}], count: ${b.count} },`).join("\n");
  const code = [
    'import { presetRules, tabulate, toRctabSummary } from "@recount/engine";',
    "",
    "const result = tabulate({",
    `  candidates: [${candidateList}],`,
    "  // One entry per rank; two names in one rank are an overvote.",
    "  ballots: [",
    ballotLines,
    "  ],",
    '  rules: presetRules("recount-standard", 1),',
    "});",
    "",
    `result.winners;        // ${JSON.stringify(result.winners)}`,
    `result.rounds.length;  // ${result.rounds.length}`,
    `toRctabSummary(result, { contest: "Lunch" }).results[${summary.results.length - 1}].tally;`,
    `// ${JSON.stringify(last.tally).replace(/,/g, ", ").replace(/:/g, ": ")}`,
  ].join("\n");
  return { code, presets: Object.keys(PRESETS) as PresetId[] };
}
