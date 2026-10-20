import { buildCountScene } from "@/lib/countScene";
import { tabulatePoll } from "@/server/results/tabulatePoll";
import { COMMITTEE_BALLOTS, LUNCH_BALLOTS } from "@/server/seed/showcase";

/**
 * The two showcase polls counted by the engine while the page is built: the same
 * ballots the demo database is seeded with, so every figure on the sheet is real.
 */
function count(title: string, options: string[], ballots: string[][], seats: number) {
  const { results } = tabulatePoll(
    { title, presetId: "recount-standard", seats, maxRanks: null },
    // The hash only seeds tie-breaks, and neither poll has a tie.
    { labels: options, rows: ballots, sha256: "0".repeat(64) },
    null,
  );
  return { results, scene: buildCountScene({ rounds: results.rounds, options: results.candidates, seats }) };
}

export const committee = count("Residents' committee, 2 seats", ["Ana", "Ben", "Cleo", "Dev", "Eli"], COMMITTEE_BALLOTS, 2);
export const lunch = count("Lunch, closed", ["Pizza", "Tacos", "Sushi"], LUNCH_BALLOTS, 1);
