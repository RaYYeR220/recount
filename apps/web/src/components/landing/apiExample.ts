import { compactJson } from "@/lib/compactJson";
import { showcasePoll } from "@/server/seed/showcaseCvr";
import { runTabulation, type TabulateInput } from "@/server/tabulation";

export type ApiExample = {
  /** Request body as typed in the curl example. */
  body: string;
  /** What POST /api/v1/tabulate answers for it, counted by the engine at build. */
  response: string;
  winners: string[];
};

export type LunchRequest = { contest: string; candidates: string[]; ballots: Array<{ ranking: string[]; count: number }> };

/** The lunch vote's ballots as ranking patterns with counts, in the order they first appear. */
export function lunchRequest(): LunchRequest {
  const spec = showcasePoll("lunch-closed");
  const patterns = new Map<string, { ranking: string[]; count: number }>();
  for (const ranking of spec.ballots) {
    const key = JSON.stringify(ranking);
    const seen = patterns.get(key);
    if (seen) seen.count++;
    else patterns.set(key, { ranking, count: 1 });
  }
  return { contest: "Lunch", candidates: spec.options, ballots: [...patterns.values()] };
}

/** One ballot pattern per line, aligned, the way the example reads best. */
function requestBody(input: LunchRequest): string {
  const rankings = input.ballots.map((b) => `${JSON.stringify(b.ranking).replace(/","/g, '", "')},`);
  const pad = Math.max(...rankings.map((r) => r.length));
  const lines = input.ballots.map((b, i) => `    { "ranking": ${rankings[i]!.padEnd(pad)} "count": ${b.count} }`);
  return [
    "{",
    `  "contest": ${JSON.stringify(input.contest)},`,
    `  "candidates": ${JSON.stringify(input.candidates).replace(/","/g, '", "')},`,
    '  "ballots": [',
    lines.join(",\n"),
    "  ]",
    "}",
  ].join("\n");
}

export function buildApiExample(): ApiExample {
  const input = lunchRequest();
  const { output } = runTabulation(input satisfies TabulateInput);
  return { body: requestBody(input), response: compactJson(output, 72), winners: output.winners };
}
