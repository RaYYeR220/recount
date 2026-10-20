import type { GoldenMismatch } from "@recount/engine";
import { largestGap } from "@/lib/recount";

export type MatchLabel = { tone: "match" | "warn"; text: string };

/**
 * How a replay stands against the official count, in words each source earns:
 * New York and Portland certify their counts; Minneapolis publishes round results
 * (never called certified here); FairVote's copies land within a few votes.
 */
export function matchLabel(presetId: string, mismatches: readonly GoldenMismatch[]): MatchLabel {
  if (mismatches.length > 0) {
    const gap = largestGap(mismatches);
    return { tone: "warn", text: `Within ${gap} ${gap === 1 ? "vote" : "votes"} of the official count` };
  }
  if (presetId === "nyc" || presetId === "portland-stv") return { tone: "match", text: "Matches the certified count" };
  if (presetId.startsWith("minneapolis")) return { tone: "match", text: "Matches the city's published round results" };
  return { tone: "match", text: "Matches the official count" };
}

/** What a replay's figures are held against, in the words its source earns. */
export function reportName(presetId: string): string {
  return presetId.startsWith("minneapolis") ? "the city's published round results" : "the official count";
}
